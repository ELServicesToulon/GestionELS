// =================================================================
//                        MODULE QUESTIONS/RÉPONSES
// =================================================================
// Description: Gère les questions et réponses des professionnels.
// =================================================================

/**
 * Retourne la feuille de stockage des questions, en la créant si nécessaire.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} Feuille des questions.
 */
function getQuestionsSheet_() {
  const ss = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL'));
  return ss.getSheetByName(SHEET_QUESTIONS) || ss.insertSheet(SHEET_QUESTIONS);
}

/**
 * Récupère toutes les questions et leurs réponses.
 * @returns {Array<Object>} Liste des questions.
 */
function getQuestions() {
  const sheet = getQuestionsSheet_();
  const data = sheet.getDataRange().getValues();
  const questions = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const id = row[0];
    const question = row[1];
    const auteur = row[2];
    const reponses = row[3] ? JSON.parse(row[3]) : [];
    questions.push({ id: id, question: question, auteur: auteur, reponses: reponses });
  }
  return questions;
}

/**
 * Ajoute une nouvelle question.
 * @param {string} question Texte de la question.
 * @param {string} auteur Auteur de la question.
 * @returns {{success:boolean,id:number}} Résultat de l'opération.
 */
function addQuestion(question, auteur) {
  const sheet = getQuestionsSheet_();
  const id = Date.now();
  sheet.appendRow([id, question, auteur, JSON.stringify([])]);
  return { success: true, id: id };
}

/**
 * Ajoute une réponse à une question existante.
 * @param {number|string} questionId Identifiant de la question.
 * @param {string} reponse Texte de la réponse.
 * @param {string} auteur Auteur de la réponse.
 * @returns {{success:boolean}|{success:boolean,error:string}} Résultat.
 */
function addAnswer(questionId, reponse, auteur) {
  const sheet = getQuestionsSheet_();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(questionId)) {
      const reponses = data[i][3] ? JSON.parse(data[i][3]) : [];
      reponses.push({ auteur: auteur, texte: reponse });
      sheet.getRange(i + 1, 4).setValue(JSON.stringify(reponses));
      return { success: true };
    }
  }
  return { success: false, error: 'Question introuvable.' };
}
