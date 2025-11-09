/**
 * Tâche planifiée exécutée toutes les 5 minutes.
 * @return {{ok:boolean,reason?:string}}
 */
function livreurCheckAndNotify() {
  if (!LIVREUR_MODULE_ENABLED) {
    return { ok: false, reason: 'DISABLED' };
  }
  const calendarId = livreurResolveCalendarId_();
  if (!calendarId) {
    return { ok: false, reason: 'UNCONFIGURED' };
  }
  const reference = new Date();
  livreurProcessWindow_(calendarId, reference, 15, 'H-15');
  livreurProcessWindow_(calendarId, reference, 5, 'H-5');
  livreurProcessLateWindow_(calendarId, reference, 5, 'H+5');
  return { ok: true };
}

function livreurProcessWindow_(calendarId, reference, offsetMinutes, label) {
  const calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) {
    return;
  }
  const start = new Date(reference.getTime() + (offsetMinutes - 2) * 60000);
  const end = new Date(reference.getTime() + (offsetMinutes + 2) * 60000);
  const events = calendar.getEvents(start, end);
  for (var i = 0; i < events.length; i += 1) {
    const event = events[i];
    livreurNotifyEvent_(event, label, false);
  }
}

function livreurProcessLateWindow_(calendarId, reference, minutes, label) {
  const calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) {
    return;
  }
  const start = new Date(reference.getTime() - (minutes + 2) * 60000);
  const end = new Date(reference.getTime() - (minutes - 2) * 60000);
  const events = calendar.getEvents(start, end);
  for (var i = 0; i < events.length; i += 1) {
    const event = events[i];
    livreurNotifyEvent_(event, label, true);
  }
}

function livreurNotifyEvent_(event, label, lateOnly) {
  if (!event) {
    return;
  }
  const eventId = event.getId().split('@')[0];
  const meta = livreurParseEventDescription(event.getDescription());
  const cmd = livreurExtractCmd(event.getTitle());
  const driverEmail = sanitizeEmail(meta.conducteur || '');
  if (!driverEmail) {
    return;
  }
  if (lateOnly && livreurHasJournalEntry(eventId, cmd)) {
    return;
  }
  const tokens = livreurFetchDriverTokens(driverEmail);
  if (!tokens.length) {
    return;
  }
  const origin = livreurGetPwaOrigin_();
  for (var i = 0; i < tokens.length; i += 1) {
    const data = {
      eventId: eventId,
      cmd: cmd,
      driverEmail: driverEmail,
      url: origin.replace(/\/$/, '') + '/app/?eventId=' + encodeURIComponent(eventId) + '&cmd=' + encodeURIComponent(cmd)
    };
    if (lateOnly) {
      data.url += '&alert=late';
    }
    const payload = {
      notification: {
        title: 'Livraison ' + label,
        body: sanitizeScalar(meta.ehpad || '', 120) + ' ' + sanitizeScalar(meta.fenetre || '', 120)
      },
      data: data
    };
    livreurSendFcmMessage(tokens[i], payload);
  }
}

function livreurParseEventDescription(description) {
  const meta = {};
  if (!description) {
    return meta;
  }
  const lines = String(description).split(/\n|;/);
  for (var i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) {
      continue;
    }
    const parts = line.split(':');
    if (parts.length < 2) {
      continue;
    }
    const key = parts[0].trim().toLowerCase();
    const value = parts.slice(1).join(':').trim();
    if (!value) {
      continue;
    }
    if (key === 'ehpad') {
      meta.ehpad = sanitizeScalar(value, 120);
    } else if (key === 'adresse') {
      meta.adresse = sanitizeMultiline(value, 200);
    } else if (key === 'conducteur') {
      meta.conducteur = sanitizeEmail(value);
    } else if (key === 'fenetre' || key === 'fenêtre') {
      meta.fenetre = sanitizeScalar(value, 120);
    }
  }
  return meta;
}

function livreurExtractCmd(title) {
  if (!title) {
    return '';
  }
  const match = String(title).match(/CMD\s*([\w-]+)/i);
  return match ? match[1] : '';
}

function livreurFetchDriverTokens(driverEmail) {
  const sheet = livreurGetDevicesSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return [];
  }
  const range = sheet.getRange(2, 1, lastRow - 1, LIVREUR_DEVICES_HEADERS.length);
  const values = range.getValues();
  const tokens = [];
  for (var i = 0; i < values.length; i += 1) {
    const row = values[i];
    if (row[0] === driverEmail && row[1]) {
      tokens.push(String(row[1]));
    }
  }
  return tokens;
}

function livreurHasJournalEntry(eventId, cmd) {
  const sheet = livreurGetJournalSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return false;
  }
  const range = sheet.getRange(2, 1, lastRow - 1, LIVREUR_JOURNAL_HEADERS.length);
  const values = range.getValues();
  for (var i = 0; i < values.length; i += 1) {
    const row = values[i];
    if (row[1] === eventId && row[2] === cmd) {
      return true;
    }
  }
  return false;
}
