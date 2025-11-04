// =================================================================
//                        MODULE QUESTIONS/REPONSES
// =================================================================
// Description: Gere les questions et reponses des professionnels.
// =================================================================

/**
 * Retourne la feuille de stockage des questions, en la creant si necessaire.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} Feuille des questions.
 */
function getQuestionsSheet_() {
  const ss = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL'));
  return ss.getSheetByName(SHEET_QUESTIONS) || ss.insertSheet(SHEET_QUESTIONS);
}

/**
 * Recupere toutes les questions et leurs reponses.
 * @returns {Array<Object>} Liste des questions.
 */
function getQuestions(email, exp, sig) {
  assertClient(email, exp, sig);
  const sheet = getQuestionsSheet_();
  const data = sheet.getDataRange().getValues();
  const questions = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const id = row[0];
    const question = row[1];
    const auteur = row[2];
    let reponses = [];
    if (row[3]) {
      try {
        const parsed = JSON.parse(row[3]);
        if (Array.isArray(parsed)) {
          reponses = parsed;
        }
      } catch (err) {
        Logger.log('Question ignoree (JSON reponses invalide, ligne ' + (i + 1) + '): ' + err);
        continue;
      }
    }
    questions.push({ id: id, question: question, auteur: auteur, reponses: reponses });
  }
  return questions;
}

/**
 * Ajoute une nouvelle question.
 * @param {string} question Texte de la question.
 * @param {string} auteur Auteur de la question.
 * @returns {{success:boolean,id:number}} Resultat de l operation.
 */
function addQuestion(question, auteur, email, exp, sig) {
  let emailNorm = '';
  let lastError = null;
  // Autorise un repli sur l'auteur si l'email n'est pas passé côté client.
  const candidats = [email, auteur];

  for (let i = 0; i < candidats.length; i++) {
    const candidat = candidats[i];
    if (!candidat) continue;
    try {
      emailNorm = assertClient(candidat, exp, sig);
      break;
    } catch (err) {
      lastError = err;
      if (!err || err.message !== 'Email invalide.') {
        throw err;
      }
    }
  }

  if (!emailNorm) {
    throw lastError || new Error('Email invalide.');
  }

  const sheet = getQuestionsSheet_();
  const id = Date.now();
  sheet.appendRow([id, question, emailNorm, JSON.stringify([])]);
  return { success: true, id: id };
}

/**
 * Ajoute une reponse a une question existante.
 * @param {number|string} questionId Identifiant de la question.
 * @param {string} reponse Texte de la reponse.
 * @param {string} auteur Auteur de la reponse.
 * @returns {{success:boolean}|{success:boolean,error:string}} Resultat.
 */
function addAnswer(questionId, reponse, auteur, email, exp, sig) {
  assertClient(email, exp, sig);
  const sheet = getQuestionsSheet_();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(questionId)) {
      let reponses = [];
      if (data[i][3]) {
        try {
          const parsed = JSON.parse(data[i][3]);
          if (Array.isArray(parsed)) {
            reponses = parsed;
          }
        } catch (err) {
          Logger.log('Impossible de parser les reponses existantes pour la question ' + questionId + ': ' + err);
          reponses = [];
        }
      }
      reponses.push({ auteur: auteur, texte: reponse });
      sheet.getRange(i + 1, 4).setValue(JSON.stringify(reponses));
      return { success: true };
    }
  }
  return { success: false, error: 'Question introuvable.' };
}
