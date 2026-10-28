// The page frame's interface text, built from the message files
// (lib/ui-text.ts). Until 28 Oct 2026 this was a table copied from the built
// pages at launch-rbm-test 7c1bf11 ({en,fr,pt}/index.html and
// assets/report-issue.js), mistakes included; that table is now
// tests/fixtures/text/frame-text.ts, which the frame's tests compare with
// those files, and tests/text-parity.test.ts proves frameText() returns
// exactly it. The French has a no-break space (U+00A0) before some colons,
// semicolons and question marks, not all, as the pages do.
//
// "{name}" marks where a value goes. The four status words the CSV uses are
// pageText().status in lib/strings.ts.
import type { CsvText, FeedbackType } from "@/lib/frame";
import type { Locale } from "@/lib/locales";
import { around, uiText } from "@/lib/ui-text";

export interface HeaderText {
  title: string;
  poweredBy: string;
  /** the Unitaid logo's alt text */
  logoAlt: string;
  subtitle: string;
  /** "Last updated {date}" */
  lastUpdated: string;
  downloadCsv: string;
}

export interface SubscribeText {
  /** the header button */
  open: string;
  title: string;
  intro: string;
  firstName: string;
  lastName: string;
  email: string;
  emailPlaceholder: string;
  organisation: string;
  /** after "Organisation", in its own span */
  optional: string;
  submit: string;
  sending: string;
  /** the privacy line under the form */
  note: string;
  needNames: string;
  needEmail: string;
  already: string;
  subscribed: string;
  failed: string;
}

/** Each message is a bold lead, then the rest. */
export interface BannerText {
  illustrativeHead: string;
  illustrativeBody: string;
  /** the link to #disclaimer at the end of the illustrative banner */
  disclaimerLink: string;
  /** the loader's: the data could not be loaded */
  failHead: string;
  failBody: string;
  /** the loader's: a schema_version this code does not know */
  schemaHead: string;
  schemaBody: string;
}

export interface FooterText {
  disclaimerTitle: string;
  /** the second paragraph is split where the country sentence goes */
  disclaimer: readonly [p1: string, p2BeforeCountries: string, p2AfterCountries: string, p3: string];
  verifiedFor: string;
  notVerifiedFor: string;
  aboutTitle: string;
  about: readonly [string, string, string];
  dataTitle: string;
  data: string;
  sourcesTitle: string;
  sourcesIntro: string;
  keyDocsHead: string;
  keyDocsBody: string;
  /** before a source's raw data address */
  rawData: string;
  definitionsTitle: string;
}

/**
 * The feedback widget's COPY, with the page's own overrides (intro,
 * messagePlaceholder) already applied. Three texts differ when the form is
 * connected (a forms address is set): note, doneTitle, doneMessage.
 */
export interface FeedbackText {
  pill: string;
  title: string;
  intro: string;
  typeLabel: string;
  types: Record<FeedbackType, string>;
  productLabel: string;
  /** after an optional field's label, in its own span */
  optional: string;
  /** the first medicine choice */
  general: string;
  /** after a planned medicine's name */
  planned: string;
  messageLabel: string;
  messagePlaceholder: string;
  nameLabel: string;
  emailLabel: string;
  orgLabel: string;
  orgPlaceholder: string;
  note: { connected: string; notConnected: string };
  cancel: string;
  submit: string;
  sending: string;
  failed: string;
  doneTitle: { connected: string; notConnected: string };
  doneMessage: { connected: string; notConnected: string };
  /** "Reference {ref}" */
  reference: string;
  again: string;
  /** the × button's label and the done screen's button */
  close: string;
  errEmpty: string;
  errShort: string;
  errEmail: string;
}

export interface FrameText {
  header: HeaderText;
  subscribe: SubscribeText;
  banner: BannerText;
  footer: FooterText;
  csv: CsvText;
  feedback: FeedbackText;
}

const built = new Map<Locale, FrameText>();

/** One language's FrameText, built once. */
export function frameText(locale: Locale): FrameText {
  let t = built.get(locale);
  if (t) return t;
  const m = uiText(locale);
  const sub = m.subscribe;
  const fb = m.feedback;
  const col = m.download.columns;
  // The disclaimer names the medicines itself (countryCheckText): it takes
  // the words before {medicines}, and adds the list and ". " after them.
  const lead = (key: "countriesVerified" | "countriesNotVerified") => {
    const [before, after] = around(m.disclaimer[key], "medicines");
    if (after !== ".") throw new Error(`disclaimer.${key} goes on after {medicines}: "${after}"`);
    return before.trimEnd();
  };
  t = {
    header: {
      title: m.header.title,
      poweredBy: m.header.poweredBy,
      logoAlt: m.header.unitaidLogoAlt,
      subtitle: m.header.description,
      lastUpdated: m.header.lastUpdated,
      downloadCsv: m.download.button,
    },
    subscribe: {
      open: sub.button,
      title: sub.title,
      intro: sub.intro,
      firstName: sub.firstName,
      lastName: sub.lastName,
      email: sub.email,
      emailPlaceholder: sub.emailPlaceholder,
      organisation: sub.organisation,
      optional: sub.optional,
      submit: sub.submit,
      sending: sub.sending,
      note: sub.privacyNote,
      needNames: sub.nameMissing,
      needEmail: sub.emailInvalid,
      already: sub.alreadySubscribed,
      subscribed: sub.subscribed,
      failed: sub.failed,
    },
    banner: {
      illustrativeHead: m.banner.mockupTitle,
      illustrativeBody: m.banner.mockupBody,
      disclaimerLink: m.banner.mockupLink,
      failHead: m.errors.dataFailedTitle,
      failBody: m.errors.dataFailedRetry,
      schemaHead: m.errors.updatingTitle,
      schemaBody: m.errors.updatingBody,
    },
    footer: {
      disclaimerTitle: m.disclaimer.title,
      disclaimer: [m.disclaimer.notComplete, m.disclaimer.noLiability, m.disclaimer.ownChecks, m.disclaimer.notEverything],
      verifiedFor: lead("countriesVerified"),
      notVerifiedFor: lead("countriesNotVerified"),
      aboutTitle: m.about.launchTitle,
      about: [m.about.launchPurpose, m.about.launchScope, m.about.launchNoEndorsement],
      dataTitle: m.about.dataTitle,
      data: m.about.dataBody,
      sourcesTitle: m.sources.title,
      sourcesIntro: m.sources.intro,
      keyDocsHead: m.sources.keyDocumentsTitle,
      keyDocsBody: m.sources.keyDocumentsIntro,
      rawData: m.sources.rawData,
      definitionsTitle: m.about.definitionsTitle,
    },
    csv: {
      columns: {
        product: col.product,
        record: col.record,
        item: col.item,
        status: col.status,
        detail: col.detail,
        date: col.date,
        next: col.nextStep,
        anticipated: col.anticipated,
        source: col.source,
        asOf: col.asOf,
      },
      stageRow: m.download.records.stage,
      milestoneRow: m.download.records.milestone,
    },
    feedback: {
      pill: fb.open,
      title: fb.title,
      intro: fb.intro,
      typeLabel: fb.typeLabel,
      types: {
        correction: fb.types.correction,
        source: fb.types.source,
        suggestion: fb.types.suggestion,
        other: fb.types.other,
      },
      productLabel: fb.productLabel,
      // the widget wrote the dash itself, in its own span after the label
      optional: `— ${fb.optional}`,
      general: fb.productGeneral,
      // the widget put the medicine's name first, then this
      planned: around(fb.productPlanned, "medicine")[1],
      messageLabel: fb.messageLabel,
      messagePlaceholder: fb.messagePlaceholder,
      nameLabel: fb.name,
      emailLabel: fb.email,
      orgLabel: fb.organisation,
      orgPlaceholder: fb.organisationPlaceholder,
      note: { connected: fb.note, notConnected: fb.notConnected.note },
      cancel: fb.cancel,
      submit: fb.submit,
      sending: fb.sending,
      failed: fb.failed,
      doneTitle: { connected: fb.doneTitle, notConnected: fb.notConnected.doneTitle },
      doneMessage: { connected: fb.doneMessage, notConnected: fb.notConnected.doneMessage },
      reference: fb.reference,
      again: fb.again,
      close: fb.closeLabel,
      errEmpty: fb.messageMissing,
      errShort: fb.messageTooShort,
      errEmail: fb.emailInvalid,
    },
  };
  built.set(locale, t);
  return t;
}
