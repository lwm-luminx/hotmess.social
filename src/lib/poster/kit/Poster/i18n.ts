// The languages posters print in (doc/design-system/Posters.md, "Languages"). Every fixed line a poster prints lives
// here, once per language, so a Spanish poster never shows an English leftover. Staff pick the language per poster;
// it starts from the venue's place (a venue in Mexico or Puerto Rico starts in Spanish).
//
// The Spanish is Latin American and reads the same in Mexico and the US: tú, "celular", "carro", no vosotros. It
// avoids gendered words where a neutral one reads naturally ("a salvo", "alguien que viene contigo").

/** One language's copy. */
export type PosterTongue = 'en' | 'es'
/** What a poster prints in: English, Spanish, or both on the same poster (English first, Spanish under it). */
export type PosterLanguage = PosterTongue | 'en-es'

export const POSTER_LANGUAGES: Array<{ value: PosterLanguage; label: string }> = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español (Spanish)' },
    { value: 'en-es', label: 'English + Español (both)' },
]

/**
 * The BCP 47 tag for dates and the page's lang attribute. es-US formats like es-MX ("21 nov 2027"). A bilingual
 * poster prints dates the English way, which reads fine to both.
 */
export const DATE_LOCALE: Record<PosterLanguage, string> = { en: 'en-US', es: 'es-US', 'en-es': 'en-US' }

/** The language a poster's own `lang` attribute names: a bilingual poster is English with Spanish spans. */
export const pageLang = (language: PosterLanguage): PosterTongue => (language === 'es' ? 'es' : 'en')

/** Whether a poster prints Spanish at all (so English-only slogans aren't offered). */
export const printsSpanish = (language: PosterLanguage) => language !== 'en'

/**
 * Time zones whose venues start in Spanish: Mexico's, Puerto Rico's, and Spanish-speaking Central and South America's.
 * US venues start in English, since most US Spanish-speaking nights are one night at an English-speaking venue.
 */
const SPANISH_ZONES = new Set([
    'America/Mexico_City', 'America/Cancun', 'America/Merida', 'America/Monterrey', 'America/Matamoros',
    'America/Chihuahua', 'America/Ciudad_Juarez', 'America/Ojinaga', 'America/Mazatlan', 'America/Bahia_Banderas',
    'America/Hermosillo', 'America/Tijuana', 'America/Puerto_Rico', 'America/Santo_Domingo', 'America/Havana',
    'America/Guatemala', 'America/El_Salvador', 'America/Tegucigalpa', 'America/Managua', 'America/Costa_Rica',
    'America/Panama', 'America/Bogota', 'America/Caracas', 'America/Lima', 'America/Guayaquil', 'America/La_Paz',
    'America/Santiago', 'America/Argentina/Buenos_Aires', 'America/Montevideo', 'America/Asuncion',
    'Europe/Madrid', 'Atlantic/Canary',
])

/** The language a poster starts in for a venue in this time zone (its locale's); staff can change it. */
export function defaultPosterLanguage(timeZone: string | null | undefined): PosterLanguage {
    return timeZone && SPANISH_ZONES.has(timeZone) ? 'es' : 'en'
}

export function posterDate(iso: string, language: PosterLanguage): string {
    return new Date(iso).toLocaleDateString(DATE_LOCALE[language], { year: 'numeric', month: 'short', day: 'numeric' })
}

/**
 * An event's start the way a poster prints it: "Fri, Nov 21, 9pm" or "vie, 21 de nov, 9 p.m.". Null when there is no
 * start to format, so the caller keeps its own text.
 */
export function posterWhen(at: string | null | undefined, timeZone: string | undefined, language: PosterLanguage): string | null {
    if (!at) return null
    const d = new Date(at)
    if (Number.isNaN(d.getTime())) return null
    const locale = DATE_LOCALE[language]
    const sameYear = new Intl.DateTimeFormat(locale, { timeZone, year: 'numeric' }).format(d)
        === new Intl.DateTimeFormat(locale, { timeZone, year: 'numeric' }).format(new Date())
    const day = d.toLocaleDateString(locale, {
        timeZone, weekday: 'short', month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric',
    })
    const onTheHour = Number(new Intl.DateTimeFormat('en-US', { timeZone, minute: 'numeric' }).format(d)) === 0
    const time = d.toLocaleTimeString(locale, { timeZone, hour: 'numeric', minute: onTheHour ? undefined : '2-digit' })
    return language !== 'es'
        ? `${day}, ${time.replace(/:00/, '').replace(/\s?([AP])M/, (_, x: string) => x.toLowerCase() + 'm')}`
        : `${day}, ${time}`
}

/** The fixed lines of every poster, by language. Names, addresses and links are filled in by the poster. */
export interface PosterStrings {
    // Shared
    scanWithCamera: string
    /** The slogan footer and headliner's default "when" for a venue. */
    seeTonight: string
    seeWhereNext: string
    // Classic find-us poster
    isOn: (name: string, audience: string) => string
    findOn: (name: string, audience: string) => string
    seeOn: (name: string, audience: string) => string
    haveApp: string
    opensOn: { venue: (name: string) => string; event: (name: string) => string; person: (name: string) => string }
    noAppYet: string
    noAppBody: (name: string, audience: string) => string
    comingUp: string
    tips: string
    codeWorksUntil: (date: string) => string
    posterTitle: (name: string) => string
    // Slogan poster footer (canvas)
    tagline: string
    getApp: (audience: string) => string
    freeOnPhones: string
    findYourPeople: string
    scanToOpen: (audience: string) => string
    scanToDownload: string
    // Headliner poster (canvas)
    presents: (brand: string) => string
    /** The billing line under the title: "with Anya · Darcy". */
    billingWith: (names: string) => string
    scanForNight: string
    posterBy: (credit: string) => string
    // Safety poster
    safety: SafetyStrings
}

/**
 * The safety poster's lines. No jokes and no slang here: someone reading it may be scared. The Angel Shot orders keep
 * the English drink words next to the Spanish ones, since many bar staff learned them in English.
 */
export interface SafetyStrings {
    headline: string
    kicker: (venue: string) => string
    tellStaff: string
    tellStaffBody: string
    orAskAtBar: string
    angelaQuestion: string
    angelaBody: string
    orOrderAtBar: string
    angelShot: Array<{ order: string; detail: string; action: string; /** The English drink words, printed small under a translation. */ english?: string }>
    noScene: string
    inDanger: (number: string) => string
    title: (venue: string) => string
}

export const POSTER_STRINGS: Record<PosterTongue, PosterStrings> = {
    en: {
        scanWithCamera: 'Scan with your camera',
        seeTonight: 'See what’s on tonight',
        seeWhereNext: 'See where they’re on next',
        isOn: (name, audience) => `<b>${name}</b> is on ${audience}`,
        findOn: (name, audience) => `Find ${name} on ${audience}`,
        seeOn: (name, audience) => `See ${name} on ${audience}`,
        haveApp: 'Have the app?',
        opensOn: {
            venue: (name) => `It opens right on <strong>${name}</strong>: tonight’s lineup, cover and the room’s chat.`,
            event: (name) => `It opens right on <strong>${name}</strong>: who’s on, when it starts and the room’s chat.`,
            person: (name) => `It opens right on <strong>${name}</strong>: their next gigs, their music and tips.`,
        },
        noAppYet: 'No app yet?',
        noAppBody: (name, audience) => `See ${name} on the web, then get <strong>${audience}</strong> free on the App Store or Google Play.`,
        comingUp: 'Coming up',
        tips: 'Tips',
        codeWorksUntil: (date) => `Code works until ${date}`,
        posterTitle: (name) => `${name} poster`,
        tagline: 'find your night',
        getApp: (audience) => `Get ${audience}`,
        freeOnPhones: 'Free on iPhone and Android',
        findYourPeople: 'Find your people tonight',
        scanToOpen: (audience) => `Scan to open it in ${audience} →`,
        scanToDownload: 'Scan to download →',
        presents: (brand) => `${brand} presents`,
        billingWith: (names) => `with ${names}`,
        scanForNight: 'Scan for the night',
        posterBy: (credit) => `Poster by ${credit}`,
        safety: {
            headline: 'Need help?',
            kicker: (venue) => `Feeling unsafe, or worried about a friend? <b>${venue}</b> staff will help, no questions asked.`,
            tellStaff: 'Tell staff quietly',
            tellStaffBody: 'The staff on shift get it right away and come find you. <strong>No app or account needed.</strong> You can tell them where you are and message them while you wait.',
            orAskAtBar: 'Or ask at the bar',
            angelaQuestion: '“Is Angela here?”',
            angelaBody: 'Ask any staff member for <strong>Angela</strong> and they’ll get you out quietly: a ride home, a friend, or the police if you want them.',
            orOrderAtBar: 'Or order one at the bar',
            angelShot: [
                { order: 'Angel Shot', detail: 'neat', action: 'A staff member walks you to your car.' },
                { order: 'Angel Shot', detail: 'on the rocks', action: 'Staff call you a ride and wait with you.' },
                { order: 'Angel Shot', detail: 'with lime', action: 'Staff call the police for you.' },
            ],
            noScene: 'Staff won’t make a scene. Just order it like any drink.',
            inDanger: (number) => `In danger right now? Call <b>${number}</b>`,
            title: (venue) => `${venue} safety poster`,
        },
    },
    es: {
        scanWithCamera: 'Escanea con tu cámara',
        seeTonight: 'Mira qué hay esta noche',
        seeWhereNext: 'Mira dónde se presenta después',
        isOn: (name, audience) => `<b>${name}</b> está en ${audience}`,
        findOn: (name, audience) => `Encuentra ${name} en ${audience}`,
        seeOn: (name, audience) => `Sigue a ${name} en ${audience}`,
        haveApp: '¿Ya tienes la app?',
        opensOn: {
            venue: (name) => `Se abre directo en <strong>${name}</strong>: el lineup de hoy, el cover y el chat del lugar.`,
            event: (name) => `Se abre directo en <strong>${name}</strong>: quién se presenta, a qué hora empieza y el chat del lugar.`,
            person: (name) => `Se abre directo en <strong>${name}</strong>: sus próximas fechas, su música y sus propinas.`,
        },
        noAppYet: '¿Todavía no tienes la app?',
        noAppBody: (name, audience) => `Mira ${name} en la web y descarga <strong>${audience}</strong> gratis en el App Store o Google Play.`,
        comingUp: 'Próximas fechas',
        tips: 'Propinas',
        codeWorksUntil: (date) => `El código funciona hasta el ${date}`,
        posterTitle: (name) => `Cartel de ${name}`,
        tagline: 'encuentra tu noche',
        getApp: (audience) => `Descarga ${audience}`,
        freeOnPhones: 'Gratis en iPhone y Android',
        findYourPeople: 'Encuentra a tu gente esta noche',
        scanToOpen: (audience) => `Escanea para abrirlo en ${audience} →`,
        scanToDownload: 'Escanea para descargar →',
        presents: (brand) => `${brand} presenta`,
        billingWith: (names) => `con ${names}`,
        scanForNight: 'Escanea y ve la noche',
        posterBy: (credit) => `Cartel de ${credit}`,
        safety: {
            headline: '¿Necesitas ayuda?',
            kicker: (venue) => `¿No te sientes a salvo, o te preocupa alguien que viene contigo? El personal de <b>${venue}</b> te ayuda, sin hacer preguntas.`,
            tellStaff: 'Avisa al personal sin llamar la atención',
            tellStaffBody: 'El personal de turno recibe tu aviso al instante y va a buscarte. <strong>No necesitas la app ni una cuenta.</strong> Puedes decirles dónde estás y mandarles mensajes mientras esperas.',
            orAskAtBar: 'O pregunta en la barra',
            angelaQuestion: '“¿Está Angela?”',
            angelaBody: 'Pregunta por <strong>Angela</strong> a cualquier persona del personal y te ayudarán a salir sin llamar la atención: con un transporte a casa, con alguien de confianza o con la policía, si así lo quieres.',
            orOrderAtBar: 'O pide uno en la barra',
            angelShot: [
                { order: 'Angel Shot', detail: 'solo', english: 'neat', action: 'Alguien del personal te acompaña a tu carro.' },
                { order: 'Angel Shot', detail: 'con hielo', english: 'on the rocks', action: 'El personal te pide un transporte y espera contigo.' },
                { order: 'Angel Shot', detail: 'con limón', english: 'with lime', action: 'El personal llama a la policía por ti.' },
            ],
            noScene: 'El personal no hará una escena. Pídelo como cualquier otra bebida.',
            inDanger: (number) => `¿Estás en peligro ahora mismo? Llama al <b>${number}</b>`,
            title: (venue) => `Cartel de seguridad de ${venue}`,
        },
    },
}

/**
 * Lines that sit in a headline, on a canvas, or in a short label: both languages on one line, "English · Español".
 * Every other line is a paragraph, where the Spanish follows the English as its own line (`.alt`).
 */
const INLINE = new Set(['scanWithCamera', 'seeTonight', 'seeWhereNext', 'findOn', 'seeOn', 'haveApp', 'noAppYet', 'comingUp',
    'tips', 'codeWorksUntil', 'posterTitle', 'tagline', 'getApp', 'freeOnPhones', 'findYourPeople', 'scanToOpen',
    'scanToDownload', 'presents', 'billingWith', 'scanForNight', 'posterBy', 'headline', 'tellStaff', 'orAskAtBar',
    'angelaQuestion', 'orOrderAtBar', 'title'])

function both(key: string, en: string, es: string): string {
    if (en === es) return en
    return INLINE.has(key) ? `${en} · ${es}` : `${en}<span class="alt" lang="es">${es}</span>`
}

function combine<T>(en: T, es: T): T {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(en as Record<string, unknown>)) {
        const other = (es as Record<string, unknown>)[key]
        if (typeof value === 'string') out[key] = both(key, value, other as string)
        else if (typeof value === 'function') {
            out[key] = (...args: string[]) => both(key, (value as (...a: string[]) => string)(...args), (other as (...a: string[]) => string)(...args))
        } else out[key] = value
    }
    return out as T
}

/** The bilingual poster's lines: English, then Spanish. */
const BOTH: PosterStrings = (() => {
    const { en, es } = POSTER_STRINGS
    const shots = en.safety.angelShot.map((shot, i) => ({
        order: shot.order,
        detail: `${shot.detail} · ${es.safety.angelShot[i].detail}`,
        action: `${shot.action}<span class="alt" lang="es">${es.safety.angelShot[i].action}</span>`,
    }))
    return {
        ...combine(en, es),
        opensOn: combine(en.opensOn, es.opensOn),
        safety: { ...combine(en.safety, es.safety), angelShot: shots },
        // Canvas lines that have to stay short, and the billing, whose names shouldn't print twice.
        presents: (brand) => `${brand} presents · presenta`,
        billingWith: (names) => `with / con ${names}`,
        scanForNight: 'Scan · Escanea',
        scanToOpen: () => 'Scan · Escanea →',
        scanToDownload: 'Scan · Escanea →',
    }
})()

export const posterStrings = (language: PosterLanguage): PosterStrings => (language === 'en-es' ? BOTH : POSTER_STRINGS[language])
