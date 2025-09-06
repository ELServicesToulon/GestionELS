/* ===========================================================
   A11y helpers — focus trap pour <dialog>, gestion ESC
   =========================================================== */
function focusableSelectors(){
  return [
    'a[href]','area[href]','input:not([disabled])','select:not([disabled])',
    'textarea:not([disabled])','button:not([disabled])','iframe','object','embed',
    '[contenteditable]','[tabindex]:not([tabindex="-1"])'
  ].join(',');
}

function trapFocus(container){
  const focusables = Array.from(container.querySelectorAll(focusableSelectors()))
    .filter(el=>el.offsetParent !== null || container.open); // garder éléments visibles
  const first = focusables[0];
  const last = focusables[focusables.length-1];

  function onKey(e){
    if(e.key === "Tab"){
      if(e.shiftKey && document.activeElement === first){ last.focus(); e.preventDefault(); }
      else if(!e.shiftKey && document.activeElement === last){ first.focus(); e.preventDefault(); }
    }else if(e.key === "Escape"){
      // si c'est un <dialog>, on peut le fermer
      const isDialog = container.nodeName.toLowerCase()==="dialog";
      if(isDialog) closeDialog(container);
    }
  }

  container.__focusTrapHandler = onKey; // store
  container.addEventListener("keydown", onKey);
  first?.focus();
}

function releaseTrap(container){
  if(container.__focusTrapHandler){
    container.removeEventListener("keydown", container.__focusTrapHandler);
    delete container.__focusTrapHandler;
  }
}

// Ouvre un <dialog> accessible (ou un div modal)
function openDialog(el){
  if(el.nodeName.toLowerCase()==="dialog" && typeof el.showModal === "function"){
    el.showModal();
  }else{
    el.hidden = false; el.setAttribute("aria-modal","true");
  }
  trapFocus(el);
}

// Ferme le <dialog>
function closeDialog(el){
  releaseTrap(el);
  if(el.nodeName.toLowerCase()==="dialog" && typeof el.close === "function"){
    el.close();
  }else{
    el.hidden = true; el.removeAttribute("aria-modal");
  }
  // focus de confort : ramener sur l’élément déclencheur si possible
  const opener = document.querySelector('[data-open="'+el.id+'"]');
  opener?.focus();
}

// Expose global (facile à utiliser dans app.js)
if (typeof window !== "undefined") {
  window.openDialog = openDialog;
  window.closeDialog = closeDialog;
}
