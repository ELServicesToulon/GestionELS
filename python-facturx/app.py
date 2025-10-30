import io
import logging
import os
import time
import uuid
from datetime import datetime

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.responses import Response
from lxml import etree
from pikepdf import Array, Dictionary, Name, Pdf, PdfError, String

APP_TITLE = "ELS Factur-X Embed Service"
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
XML_ATTACHMENT_NAME = "facturx.xml"

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("facturx")

app = FastAPI(title=APP_TITLE, version="1.0.0")


def get_expected_token() -> str:
  token = os.getenv("FACTURX_TOKEN")
  if not token:
    raise HTTPException(status_code=500, detail="FACTURX_TOKEN missing on server")
  return token


async def authorize(
  authorization: str = Header(default=None),
  x_request_id: str = Header(default=None),
  token: str = Depends(get_expected_token)
) -> str:
  if not authorization or not authorization.startswith("Bearer "):
    logger.warning("authorization_missing")
    raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
  provided = authorization.split(" ", 1)[1].strip()
  if provided != token:
    logger.warning("authorization_invalid")
    raise HTTPException(status_code=401, detail="Invalid bearer token")
  return x_request_id or str(uuid.uuid4())


async def read_upload(file: UploadFile, expected_content_type: str, request_id: str) -> bytes:
  if file.content_type != expected_content_type:
    logger.warning(
      "invalid_content_type request_id=%s field=%s content_type=%s expected=%s",
      request_id,
      file.filename,
      file.content_type,
      expected_content_type
    )
    raise HTTPException(status_code=415, detail=f"Invalid content type for {file.filename or 'file'}")

  data = await file.read()
  if len(data) == 0:
    raise HTTPException(status_code=422, detail=f"{file.filename or 'file'} is empty")

  if len(data) > MAX_UPLOAD_SIZE:
    raise HTTPException(status_code=413, detail=f"{file.filename or 'file'} exceeds {MAX_UPLOAD_SIZE // (1024 * 1024)} MB")
  return data


def validate_xml(xml_bytes: bytes) -> None:
  try:
    etree.fromstring(xml_bytes)
  except etree.XMLSyntaxError as exc:
    raise HTTPException(status_code=422, detail=f"Invalid XML payload: {exc}") from exc


def embed_facturx(pdf_bytes: bytes, xml_bytes: bytes, request_id: str) -> bytes:
  try:
    with Pdf.open(io.BytesIO(pdf_bytes)) as pdf_doc:
      root = pdf_doc.root

      xml_stream = pdf_doc.make_stream(xml_bytes)
      xml_stream[Name("/Type")] = Name("/EmbeddedFile")
      xml_stream[Name("/Subtype")] = Name("/application#2Fxml")

      filespec = pdf_doc.make_indirect(Dictionary({
        Name("/Type"): Name("/Filespec"),
        Name("/F"): String(XML_ATTACHMENT_NAME),
        Name("/UF"): String(XML_ATTACHMENT_NAME),
        Name("/AFRelationship"): Name("/Data"),
        Name("/Desc"): String("Factur-X EN16931 structured data"),
        Name("/EF"): Dictionary({
          Name("/F"): xml_stream,
          Name("/UF"): xml_stream
        })
      }))

      names_dict = root.get(Name("/Names"))
      if names_dict is None:
        names_dict = pdf_doc.make_indirect(Dictionary())
        root[Name("/Names")] = names_dict

      embedded_dict = names_dict.get(Name("/EmbeddedFiles"))
      if embedded_dict is None:
        embedded_dict = pdf_doc.make_indirect(Dictionary({Name("/Names"): Array()}))
        names_dict[Name("/EmbeddedFiles")] = embedded_dict

      names_array = embedded_dict.get(Name("/Names"))
      if names_array is None:
        names_array = pdf_doc.make_indirect(Array())
        embedded_dict[Name("/Names")] = names_array

      # purge previous attachment with same name
      filtered = Array()
      for i in range(0, len(names_array), 2):
        label = str(names_array[i])
        if label.lower() != XML_ATTACHMENT_NAME.lower():
          filtered.append(names_array[i])
          filtered.append(names_array[i + 1])
      names_array.clear()
      for item in filtered:
        names_array.append(item)
      names_array.append(String(XML_ATTACHMENT_NAME))
      names_array.append(filespec)

      af_array = root.get(Name("/AF"))
      if af_array is None:
        af_array = pdf_doc.make_indirect(Array())
        root[Name("/AF")] = af_array
      af_array.clear()
      af_array.append(filespec)

      metadata = pdf_doc.open_metadata()
      metadata.register_namespace("pdfaid", "http://www.aiim.org/pdfa/ns/id/")
      metadata.register_namespace("xmp", "http://ns.adobe.com/xap/1.0/")
      metadata.register_namespace("dc", "http://purl.org/dc/elements/1.1/")
      metadata.register_namespace("fx", "urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#")
      timestamp = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
      metadata["pdfaid:part"] = "3"
      metadata["pdfaid:conformance"] = "U"
      metadata["fx:DocumentFileName"] = XML_ATTACHMENT_NAME
      metadata["fx:Version"] = "1.0"
      metadata["fx:ConformanceLevel"] = "BASIC"
      metadata["xmp:CreateDate"] = timestamp
      metadata["xmp:ModifyDate"] = timestamp
      metadata["xmp:MetadataDate"] = timestamp
      metadata["dc:format"] = "application/pdf"

      info = pdf_doc.docinfo
      info["Producer"] = APP_TITLE
      info["ModDate"] = timestamp

      output = io.BytesIO()
      pdf_doc.save(output, static_id=True)
      return output.getvalue()
  except PdfError as exc:
    logger.error("pdf_processing_error request_id=%s error=%s", request_id, exc)
    raise HTTPException(status_code=422, detail=f"Unable to process PDF: {exc}") from exc


@app.post("/embed", response_class=Response, summary="Embed Factur-X XML into PDF/A-3")
async def embed_endpoint(
  pdf: UploadFile = File(..., description="Original PDF invoice"),
  xml: UploadFile = File(..., description="Factur-X XML payload"),
  request_id: str = Depends(authorize)
) -> Response:
  start = time.time()
  logger.info(
    "embed_start request_id=%s pdf_name=%s xml_name=%s",
    request_id,
    pdf.filename,
    xml.filename
  )

  pdf_bytes = await read_upload(pdf, "application/pdf", request_id)
  xml_bytes = await read_upload(xml, "application/xml", request_id)
  validate_xml(xml_bytes)

  embedded_bytes = embed_facturx(pdf_bytes, xml_bytes, request_id)

  duration = time.time() - start
  logger.info(
    "embed_success request_id=%s pdf_size=%d xml_size=%d output_size=%d duration_ms=%d",
    request_id,
    len(pdf_bytes),
    len(xml_bytes),
    len(embedded_bytes),
    int(duration * 1000)
  )

  disposition_name = pdf.filename or "facture.pdf"
  base, _, ext = disposition_name.partition(".")
  output_name = f"{base or 'facture'}_FacturX.pdf"

  return Response(
    content=embedded_bytes,
    media_type="application/pdf",
    headers={
      "Content-Disposition": f'attachment; filename="{output_name}"',
      "X-Request-Id": request_id
    }
  )


@app.get("/healthz", summary="Health check")
async def health() -> dict:
  return {"status": "ok"}
