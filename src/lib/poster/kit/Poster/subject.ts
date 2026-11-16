// What a poster is for: a venue, an event or a performer. The pages build one from their record, and the builder
// reads only this, so the venue, event and person pages share one poster card.

export type PosterSubjectKind = 'venue' | 'event' | 'person'

export interface PosterGig {
    name: string
    when: string
    where: string | null
}

export interface PosterSubject {
    kind: PosterSubjectKind
    id: string
    name: string
    /** Where it is: a venue's address, an event's venue, a performer's home venue. Printed small. */
    where: string | null
    /** When: an event's start, or a performer's next gig. */
    when: string | null
    /** An event's start as an instant and its zone, so a poster in another language can print it in that language. */
    startAt?: { at: string; timeZone?: string } | null
    /** A performer's next gigs, soonest first; the performer poster lists up to three. */
    gigs?: PosterGig[]
    /** Where fans tip a performer, as they'd type it ("cash.app/$aurora"); the performer poster prints a tip line. */
    tips?: string[]
}

/** The record's path under the audience's web app (`/venues/<id>`), which the API signs into an expiring link. */
export function subjectPath(subject: Pick<PosterSubject, 'kind'> & { id: string }): string {
    const kinds: Record<PosterSubjectKind, string> = { venue: 'venues', event: 'events', person: 'people' }
    return `/${kinds[subject.kind]}/${subject.id}`
}

export const venuePath = (venueId: string) => subjectPath({ kind: 'venue', id: venueId })

/** "the venue", "the event", "them": how the builder's copy refers to the subject. */
export function subjectNoun(subject: Pick<PosterSubject, 'kind'>): string {
    return subject.kind === 'person' ? 'them' : `the ${subject.kind}`
}

/** A performer's tip line for a poster ("Tips: cash.app/$aurora · venmo.com/aurora"), or null without any. */
export function tipLine(subject: Pick<PosterSubject, 'tips'>, label = 'Tips'): string | null {
    const tips = (subject.tips ?? []).map((t) => t.trim()).filter(Boolean)
    return tips.length ? `${label}: ${tips.join(' · ')}` : null
}

/** A tip URL the way it's printed: "cash.app/$aurora", never the scheme. */
export const printedTip = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '')
