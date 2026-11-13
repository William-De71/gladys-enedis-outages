// -----------------------------------------------------------------------------
// Texts of the integration, in English, French, German and Spanish (English
// fallback).
//
// The manifest carries its own labels; these are the texts the code writes at
// runtime: device and feature names, widget contents, scene summaries,
// messages of the Configuration screen. Vocabulary of the Gladys interface:
// appareil / Gerät / dispositivo, scène / Szene / escena. "Enedis" and the
// labels Enedis writes ("Incident HTA") stay as they are.
// -----------------------------------------------------------------------------

const LANGUAGES = ['en', 'fr', 'de', 'es'];

const TEXTS = {
  // devices
  deviceName: {
    en: 'Enedis {place}',
    fr: 'Enedis {place}',
    de: 'Enedis {place}',
    es: 'Enedis {place}',
  },
  featureStatus: {
    en: 'Power outage',
    fr: 'Coupure de courant',
    de: 'Stromausfall',
    es: 'Corte de luz',
  },
  featureOutages: {
    en: 'Outages in the commune',
    fr: 'Coupures dans la commune',
    de: 'Ausfälle in der Gemeinde',
    es: 'Cortes en el municipio',
  },
  featureSituation: {
    en: 'Situation',
    fr: 'Situation',
    de: 'Lage',
    es: 'Situación',
  },

  // situation (text feature, scene action)
  situationNone: {
    en: 'No outage in progress.',
    fr: 'Aucune coupure en cours.',
    de: 'Kein laufender Ausfall.',
    es: 'Ningún corte en curso.',
  },
  situationCrisis: {
    en: 'Exceptional event: Enedis may not list every outage.',
    fr: 'Événement exceptionnel : Enedis peut ne pas lister toutes les coupures.',
    de: 'Außergewöhnliches Ereignis: Enedis listet eventuell nicht jeden Ausfall.',
    es: 'Evento excepcional: Enedis puede no listar todos los cortes.',
  },
  situationStreet: {
    en: 'Outage on your street ({count} in the commune).',
    fr: 'Coupure dans votre rue ({count} dans la commune).',
    de: 'Ausfall in Ihrer Straße ({count} in der Gemeinde).',
    es: 'Corte en su calle ({count} en el municipio).',
  },
  situationCommune: {
    en: '{count} outage(s) in the commune.',
    fr: '{count} coupure(s) dans la commune.',
    de: '{count} Ausfall/Ausfälle in der Gemeinde.',
    es: '{count} corte(s) en el municipio.',
  },
  situationRestoration: {
    en: 'Restoration expected around {time}.',
    fr: 'Rétablissement prévu vers {time}.',
    de: 'Wiederversorgung gegen {time} erwartet.',
    es: 'Restablecimiento previsto hacia las {time}.',
  },

  // kinds of outages
  kind_incident: { en: 'Breakdown', fr: 'Incident', de: 'Störung', es: 'Avería' },
  kind_works: {
    en: 'Planned works',
    fr: 'Travaux',
    de: 'Arbeiten',
    es: 'Obras',
  },
  kind_shedding: {
    en: 'Load shedding',
    fr: 'Délestage',
    de: 'Lastabwurf',
    es: 'Deslastre',
  },
  kind_other: { en: 'Outage', fr: 'Coupure', de: 'Ausfall', es: 'Corte' },
  network_BT: {
    en: 'low voltage',
    fr: 'basse tension',
    de: 'Niederspannung',
    es: 'baja tensión',
  },
  network_HTA: {
    en: 'medium voltage',
    fr: 'moyenne tension',
    de: 'Mittelspannung',
    es: 'media tensión',
  },

  // scene summaries
  whereStreet: {
    en: 'On your street: {streets}.',
    fr: 'Dans votre rue : {streets}.',
    de: 'In Ihrer Straße: {streets}.',
    es: 'En su calle: {streets}.',
  },
  whereCommune: {
    en: 'Streets: {streets}.',
    fr: 'Rues : {streets}.',
    de: 'Straßen: {streets}.',
    es: 'Calles: {streets}.',
  },
  summaryStarted: {
    en: '{name}: power outage, {kind}.',
    fr: '{name} : coupure de courant, {kind}.',
    de: '{name}: Stromausfall, {kind}.',
    es: '{name}: corte de luz, {kind}.',
  },
  summaryEnded: {
    en: '{name}: power is back ({kind}).',
    fr: '{name} : le courant est rétabli ({kind}).',
    de: '{name}: der Strom ist wieder da ({kind}).',
    es: '{name}: la luz ha vuelto ({kind}).',
  },
  summaryPostponed: {
    en: '{name}: restoration postponed to {time} (was {previous}), {kind}.',
    fr: '{name} : rétablissement repoussé à {time} (au lieu de {previous}), {kind}.',
    de: '{name}: Wiederversorgung auf {time} verschoben (statt {previous}), {kind}.',
    es: '{name}: restablecimiento aplazado a las {time} (antes {previous}), {kind}.',
  },
  summaryAdvanced: {
    en: '{name}: restoration brought forward to {time} (was {previous}), {kind}.',
    fr: '{name} : rétablissement avancé à {time} (au lieu de {previous}), {kind}.',
    de: '{name}: Wiederversorgung auf {time} vorgezogen (statt {previous}), {kind}.',
    es: '{name}: restablecimiento adelantado a las {time} (antes {previous}), {kind}.',
  },
  summaryCrisisStarted: {
    en: '{name}: Enedis announces an exceptional event: {title}',
    fr: '{name} : Enedis annonce un événement exceptionnel : {title}',
    de: '{name}: Enedis meldet ein außergewöhnliches Ereignis: {title}',
    es: '{name}: Enedis anuncia un evento excepcional: {title}',
  },
  summaryCrisisEnded: {
    en: '{name}: the exceptional event is over. {title}',
    fr: '{name} : l’événement exceptionnel est terminé. {title}',
    de: '{name}: das außergewöhnliche Ereignis ist vorbei. {title}',
    es: '{name}: el evento excepcional ha terminado. {title}',
  },
  summaryPlace: {
    en: '{name}: {situation}',
    fr: '{name} : {situation}',
    de: '{name}: {situation}',
    es: '{name}: {situation}',
  },

  // widget
  readAgo: {
    en: '{place} · read {ago}',
    fr: '{place} · lu {ago}',
    de: '{place} · gelesen {ago}',
    es: '{place} · leído {ago}',
  },
  rowStreet: { en: 'Your street', fr: 'Votre rue', de: 'Ihre Straße', es: 'Su calle' },
  valueStreetHit: {
    en: 'Outage in progress',
    fr: 'Coupure en cours',
    de: 'Ausfall läuft',
    es: 'Corte en curso',
  },
  valueStreetOk: {
    en: 'Not affected',
    fr: 'Non concernée',
    de: 'Nicht betroffen',
    es: 'No afectada',
  },
  rowCommune: { en: 'Commune', fr: 'Commune', de: 'Gemeinde', es: 'Municipio' },
  valueNone: { en: 'No outage', fr: 'Aucune coupure', de: 'Kein Ausfall', es: 'Ningún corte' },
  valueCount: {
    en: '{count} outage(s)',
    fr: '{count} coupure(s)',
    de: '{count} Ausfall/Ausfälle',
    es: '{count} corte(s)',
  },
  rowRestoration: {
    en: 'Expected restoration',
    fr: 'Rétablissement prévu',
    de: 'Erwartete Wiederversorgung',
    es: 'Restablecimiento previsto',
  },
  untilTime: {
    en: 'until {time}',
    fr: 'jusqu’à {time}',
    de: 'bis {time}',
    es: 'hasta las {time}',
  },
  untilOverdue: {
    en: 'expected {time}, overdue',
    fr: 'prévue {time}, dépassée',
    de: 'erwartet {time}, überfällig',
    es: 'prevista {time}, superada',
  },
  untilUnknown: {
    en: 'end unknown',
    fr: 'fin inconnue',
    de: 'Ende unbekannt',
    es: 'fin desconocido',
  },
  detailKind: {
    en: 'Type: {value}',
    fr: 'Type : {value}',
    de: 'Art: {value}',
    es: 'Tipo: {value}',
  },
  detailStart: {
    en: 'Since: {value}',
    fr: 'Depuis : {value}',
    de: 'Seit: {value}',
    es: 'Desde: {value}',
  },
  detailRestoration: {
    en: 'Expected restoration: {value}',
    fr: 'Rétablissement prévu : {value}',
    de: 'Erwartete Wiederversorgung: {value}',
    es: 'Restablecimiento previsto: {value}',
  },
  detailStreets: {
    en: 'Places: {value}',
    fr: 'Lieux : {value}',
    de: 'Orte: {value}',
    es: 'Lugares: {value}',
  },
  unknownStreets: {
    en: 'Places not given',
    fr: 'Lieux non précisés',
    de: 'Orte nicht angegeben',
    es: 'Lugares no indicados',
  },
  badgeStreet: { en: 'Your street', fr: 'Votre rue', de: 'Ihre Straße', es: 'Su calle' },
  badge_incident: { en: 'Breakdown', fr: 'Incident', de: 'Störung', es: 'Avería' },
  badge_works: { en: 'Works', fr: 'Travaux', de: 'Arbeiten', es: 'Obras' },
  badge_shedding: { en: 'Shedding', fr: 'Délestage', de: 'Lastabwurf', es: 'Deslastre' },
  badge_other: { en: 'Outage', fr: 'Coupure', de: 'Ausfall', es: 'Corte' },
  moreOutages: {
    en: 'And {count} more outage(s).',
    fr: 'Et {count} autre(s) coupure(s).',
    de: 'Und {count} weitere(r) Ausfall/Ausfälle.',
    es: 'Y {count} corte(s) más.',
  },
  noOutageBody: {
    en: 'Enedis reports no outage in progress in the commune.',
    fr: 'Enedis ne signale aucune coupure en cours dans la commune.',
    de: 'Enedis meldet keinen laufenden Ausfall in der Gemeinde.',
    es: 'Enedis no indica ningún corte en curso en el municipio.',
  },
  notReadYet: {
    en: 'First reading of Enedis in progress…',
    fr: 'Première lecture d’Enedis en cours…',
    de: 'Erstes Lesen von Enedis läuft…',
    es: 'Primera lectura de Enedis en curso…',
  },
  placeNotRead: {
    en: '{place}: Enedis could not be read for this place.',
    fr: '{place} : Enedis n’a pas pu être lu pour ce lieu.',
    de: '{place}: Enedis konnte für diesen Ort nicht gelesen werden.',
    es: '{place}: no se pudo leer Enedis para este lugar.',
  },

  // relative times
  ago_now: { en: 'just now', fr: 'à l’instant', de: 'gerade eben', es: 'ahora mismo' },
  ago_minutes: {
    en: '{n} min ago',
    fr: 'il y a {n} min',
    de: 'vor {n} Min.',
    es: 'hace {n} min',
  },
  ago_hours: { en: '{n} h ago', fr: 'il y a {n} h', de: 'vor {n} Std.', es: 'hace {n} h' },
  ago_days: {
    en: '{n} days ago',
    fr: 'il y a {n} jours',
    de: 'vor {n} Tagen',
    es: 'hace {n} días',
  },

  // Configuration screen
  noPlace: {
    en: 'Choose a house of Gladys, or type an address, in "Places".',
    fr: 'Choisissez une maison de Gladys, ou saisissez une adresse, dans « Lieux ».',
    de: 'Wählen Sie unter „Orte“ ein Gladys-Haus oder geben Sie eine Adresse ein.',
    es: 'Elija una casa de Gladys, o escriba una dirección, en «Lugares».',
  },
  statusConnected: {
    en: 'Enedis read for {places} place(s).',
    fr: 'Enedis lu pour {places} lieu(x).',
    de: 'Enedis für {places} Ort(e) gelesen.',
    es: 'Enedis leído para {places} lugar(es).',
  },
  statusPartial: {
    en: 'Enedis read for {places} place(s); {failed} not read: {problem}',
    fr: 'Enedis lu pour {places} lieu(x) ; {failed} non lu(s) : {problem}',
    de: 'Enedis für {places} Ort(e) gelesen; {failed} nicht gelesen: {problem}',
    es: 'Enedis leído para {places} lugar(es); {failed} sin leer: {problem}',
  },
  statusNotCovered: {
    en: '{place}: Enedis does not serve this commune (a local company may).',
    fr: '{place} : Enedis ne dessert pas cette commune (une régie locale peut-être).',
    de: '{place}: Enedis versorgt diese Gemeinde nicht (evtl. ein lokaler Versorger).',
    es: '{place}: Enedis no abastece este municipio (quizá una empresa local).',
  },
  statusUnavailable: {
    en: 'The outage service of Enedis is down: new try at the next reading.',
    fr: 'Le service des coupures d’Enedis est indisponible : nouvel essai à la prochaine lecture.',
    de: 'Der Ausfalldienst von Enedis ist gestört: neuer Versuch beim nächsten Lesen.',
    es: 'El servicio de cortes de Enedis no funciona: nuevo intento en la próxima lectura.',
  },
  statusBlocked: {
    en: 'enedis.fr refused the request (protection against robots): new try later.',
    fr: 'enedis.fr a refusé la requête (protection anti-robots) : nouvel essai plus tard.',
    de: 'enedis.fr hat die Anfrage abgelehnt (Bot-Schutz): neuer Versuch später.',
    es: 'enedis.fr rechazó la petición (protección anti-robots): nuevo intento más tarde.',
  },
  statusUnreachable: {
    en: 'enedis.fr does not answer: new try at the next reading.',
    fr: 'enedis.fr ne répond pas : nouvel essai à la prochaine lecture.',
    de: 'enedis.fr antwortet nicht: neuer Versuch beim nächsten Lesen.',
    es: 'enedis.fr no responde: nuevo intento en la próxima lectura.',
  },
  statusUnexpected: {
    en: 'Enedis sent an unexpected answer: the page may have changed.',
    fr: 'Enedis a envoyé une réponse inattendue : la page a peut-être changé.',
    de: 'Enedis hat eine unerwartete Antwort gesendet: die Seite hat sich evtl. geändert.',
    es: 'Enedis envió una respuesta inesperada: la página quizá ha cambiado.',
  },
  statusAddressNotFound: {
    en: 'Address not found: "{address}". Check it, or type only the commune.',
    fr: 'Adresse introuvable : « {address} ». Vérifiez-la, ou saisissez seulement la commune.',
    de: 'Adresse nicht gefunden: „{address}“. Prüfen Sie sie oder geben Sie nur die Gemeinde ein.',
    es: 'Dirección no encontrada: «{address}». Revísela, o escriba solo el municipio.',
  },
  statusHouseNotLocated: {
    en: 'The house "{house}" has no position in Gladys: place it on the map, or type an address.',
    fr: 'La maison « {house} » n’a pas de position dans Gladys : placez-la sur la carte, ou saisissez une adresse.',
    de: 'Das Haus „{house}“ hat keine Position in Gladys: auf der Karte setzen oder eine Adresse eingeben.',
    es: 'La casa «{house}» no tiene posición en Gladys: sitúela en el mapa, o escriba una dirección.',
  },
  statusGeoUnreachable: {
    en: 'The address service of the Géoplateforme does not answer: new try later.',
    fr: 'Le service d’adresses de la Géoplateforme ne répond pas : nouvel essai plus tard.',
    de: 'Der Adressdienst der Géoplateforme antwortet nicht: neuer Versuch später.',
    es: 'El servicio de direcciones de la Géoplateforme no responde: nuevo intento más tarde.',
  },
  testPlace: {
    en: '{place} (INSEE {insee}): {situation}',
    fr: '{place} (INSEE {insee}) : {situation}',
    de: '{place} (INSEE {insee}): {situation}',
    es: '{place} (INSEE {insee}): {situation}',
  },
  testNoStreet: {
    en: 'no street: only the commune is watched',
    fr: 'sans rue : seule la commune est surveillée',
    de: 'ohne Straße: nur die Gemeinde wird überwacht',
    es: 'sin calle: solo se vigila el municipio',
  },
};

/**
 * @description Whether a value is one of the supported languages.
 * @param {unknown} value - The value.
 * @returns {boolean} True for en, fr, de or es.
 * @example
 * isLanguage('fr'); // -> true
 */
function isLanguage(value) {
  return LANGUAGES.includes(value);
}

/**
 * @description A text in a language (English fallback), with its
 * substitutions.
 * @param {string} key - The TEXTS key.
 * @param {string} language - The language.
 * @param {object} [values] - The substitutions.
 * @returns {string} The text.
 * @example
 * t('deviceName', 'fr', { place: 'Mâcon' }); // -> 'Enedis Mâcon'
 */
function t(key, language, values = {}) {
  const entry = TEXTS[key];
  if (!entry) {
    return key;
  }
  const template = entry[language] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}

/**
 * @description The text in every language, for a multi-language message.
 * @param {string} key - The TEXTS key.
 * @param {object} [values] - The substitutions.
 * @returns {{ en: string, fr: string, de: string, es: string }} The message.
 * @example
 * all('statusConnected', { places: 1 });
 */
function all(key, values = {}) {
  return Object.fromEntries(LANGUAGES.map((language) => [language, t(key, language, values)]));
}

/**
 * @description "12 min ago" for an instant.
 * @param {number} instant - The instant, in ms.
 * @param {number} now - Now, in ms.
 * @param {string} language - The language.
 * @returns {string} The relative time.
 * @example
 * ago(Date.now() - 600000, Date.now(), 'en'); // -> '10 min ago'
 */
function ago(instant, now, language) {
  const minutes = Math.max(0, Math.floor((now - instant) / 60000));
  if (minutes < 1) {
    return t('ago_now', language);
  }
  if (minutes < 60) {
    return t('ago_minutes', language, { n: minutes });
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return t('ago_hours', language, { n: hours });
  }
  return t('ago_days', language, { n: Math.floor(hours / 24) });
}

export { LANGUAGES, TEXTS, isLanguage, t, all, ago };
