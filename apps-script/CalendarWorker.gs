/**
 * Tâche planifiée 5 min.
 */
function checkAndNotify() {
  const now = new Date();
  processWindow(now, 15, 'H-15');
  processWindow(now, 5, 'H-5');
  processLateWindow(now, 5, 'H+5');
}

function processWindow(reference, offsetMinutes, label) {
  const calendarId = PropertiesService.getScriptProperties().getProperty('CALENDAR_ID') || 'CALENDAR_ID';
  const calendar = CalendarApp.getCalendarById(calendarId);
  const start = new Date(reference.getTime() + (offsetMinutes - 2) * 60 * 1000);
  const end = new Date(reference.getTime() + (offsetMinutes + 2) * 60 * 1000);
  const events = calendar.getEvents(start, end);
  events.forEach((event) => {
    const eventId = event.getId().split('@')[0];
    const meta = parseEventDescription(event.getDescription());
    const cmd = extractCmd(event.getTitle());
    const driverEmail = meta.conducteur || '';
    if (!driverEmail) {
      return;
    }
    const tokens = fetchDriverTokens(driverEmail);
    tokens.forEach((token) => {
      sendFcmMessage(token, {
        notification: {
          title: `Livraison ${label}`,
          body: `${meta.ehpad || ''} ${meta.fenetre || ''}`.trim()
        },
        data: {
          eventId: eventId,
          cmd: cmd,
          driverEmail: driverEmail,
          url: `${PropertiesService.getScriptProperties().getProperty('PWA_DOMAIN') || 'https://DOMAIN'}/app/?eventId=${eventId}&cmd=${cmd}`
        }
      });
    });
  });
}

function processLateWindow(reference, minutes, label) {
  const calendarId = PropertiesService.getScriptProperties().getProperty('CALENDAR_ID') || 'CALENDAR_ID';
  const calendar = CalendarApp.getCalendarById(calendarId);
  const start = new Date(reference.getTime() - (minutes + 2) * 60 * 1000);
  const end = new Date(reference.getTime() - (minutes - 2) * 60 * 1000);
  const events = calendar.getEvents(start, end);
  events.forEach((event) => {
    const eventId = event.getId().split('@')[0];
    const meta = parseEventDescription(event.getDescription());
    const cmd = extractCmd(event.getTitle());
    const driverEmail = meta.conducteur || '';
    if (!driverEmail) {
      return;
    }
    if (hasJournalEntry(eventId, cmd)) {
      return;
    }
    const tokens = fetchDriverTokens(driverEmail);
    tokens.forEach((token) => {
      sendFcmMessage(token, {
        notification: {
          title: `Livraison ${label}`,
          body: `Fiche non ouverte ${meta.ehpad || ''}`.trim()
        },
        data: {
          eventId: eventId,
          cmd: cmd,
          driverEmail: driverEmail,
          url: `${PropertiesService.getScriptProperties().getProperty('PWA_DOMAIN') || 'https://DOMAIN'}/app/?eventId=${eventId}&cmd=${cmd}&alert=late`
        }
      });
    });
  });
}

function parseEventDescription(description) {
  const meta = {};
  if (!description) {
    return meta;
  }
  const lines = description.split(/\n|;/);
  lines.forEach((line) => {
    const parts = line.split(':');
    if (parts.length >= 2) {
      const key = parts[0].trim().toLowerCase();
      const value = parts.slice(1).join(':').trim();
      if (key === 'ehpad') {
        meta.ehpad = value;
      } else if (key === 'adresse') {
        meta.adresse = value;
      } else if (key === 'conducteur') {
        meta.conducteur = value;
      } else if (key === 'fenetre') {
        meta.fenetre = value;
      }
    }
  });
  return meta;
}

function extractCmd(title) {
  if (!title) {
    return '';
  }
  const match = title.match(/CMD\s*(\w+)/i);
  return match ? match[1] : '';
}

function fetchDriverTokens(driverEmail) {
  const sheet = getDevicesSheet();
  const range = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 0), 4);
  const values = range.getValues();
  return values.filter((row) => row[0] === driverEmail).map((row) => row[1]).filter(Boolean);
}

function hasJournalEntry(eventId, cmd) {
  const sheet = getJournalSheet();
  const range = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 0), JOURNAL_HEADERS.length);
  const values = range.getValues();
  return values.some((row) => row[1] === eventId && row[2] === cmd);
}
