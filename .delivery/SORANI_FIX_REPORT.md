# Kurdish Translation Fix — Kurmanji → Sorani

## What Was Wrong

Several strings in `frontend/locales/ku.json` were written in **Kurmanji Latin script** (e.g. "Civakên te", "Bibînin", "Te xwedî dike", "endarm", "Post", "Civak", "Gerran", "Create", "Moderator", "Civakê bîrêve bir") instead of proper **Sorani Arabic script**. A handful of Sorani strings were also mistranslated ("وەرگرتن" for the quote toolbar button, "فڕێ بدە" for drag-and-drop, "پێشبینین" for preview, "ردکردنەوە" for dismissing a draft banner, mixed "پێنووس"/"پێشنووس" for draft, and a stray English parenthetical "(The Steel-Man Gate)").

These appeared in the most visible places: the **search bar placeholder**, the **communities page** ("Your communities" / "Discover" / "You own" badges / member counts), the **create button**, the **community manage button**, and the **editor toolbar**.

## What Was Fixed

| Key | Before (Kurmanji / flawed) | After (Sorani) |
|---|---|---|
| `search.placeholder` | Post u civakan bigerrin | گەڕان لە بیرۆکە و کۆمەڵگاکان |
| `search.placeholderMobile` | Bigerrin | گەڕان |
| `search.title` | Gerran | گەڕان |
| `search.postsTab` / `communitiesTab` | Post / Civak | بیرۆکەکان / کۆمەڵگاکان |
| `search.noResults` | Ji bo "…" encam nehatin dîtin | هیچ ئەنجامێک بۆ "…" نەدۆزرایەوە |
| `search.searching` / `error` / `resultsFor` / `postScore` | Kurmanji | گەڕان… / هەڵە لە گەڕان / ئەنجامەکان بۆ "…" / … خاڵ |
| `communities.yours` | Civakên te | کۆمەڵگاکانت |
| `communities.discover` | Bibînin | دۆزینەوە |
| `communities.youOwn` | Te xwedî dike | تۆ خاوەنیت |
| `communities.moderatorRole` | Moderator | بەڕێوەبەر |
| `communities.membersCount` | {count} endam | {count} ئەندام |
| `communities.joinFirstTitle/Body` | flawed Sorani | بەشداری بکە بۆ بینین و نوسین / بۆشاییەکی تایبەتە… بڕوانە بۆ بەشی گشتی |
| `create.create` | Create | دروستکردن |
| `membership.manageCommunity` | Civakê bîrêve bir | بەڕێوەبردنی کۆمەڵگا |
| `ui.toolbarQuote` | وەرگرتن | وتە |
| `ui.dropImages` | وێنەکان فڕێ بدە… | وێنەکان ڕابکێشە بۆ بارکردن |
| `ui.noPreview` | پێشبینین | پێشنمایش |
| `ui.minRead` | خولەک خوێندنەوە | خوێندنەوە |
| `ui.draftRestored` | پێنووس گەڕایەوە — ردکردنەوە | پێنووس / پێشنووس گەڕایەوە — داخستن (normalized) |
| `settings.signedOut` | بەخێربێیت (mismatched farewell) | خۆت بەپارێزە |
| `why.steelManGate.title` | دەروازەی پۆڵاین (The Steel-Man Gate) | دەروازەی ستیڵ-مان |
| `why.curiosityMapEmpty` | زانیاری دەستکرد | زیرەکی دەستکرد |
| `description` (page meta) | پەسەندکردنی | داگیرکردنەوەی |

Intentionally kept in Latin: keyboard-key hints ("Enter بۆ زیادکردن", "Backspace بۆ سڕینەوە"), tag-placeholder examples containing English tech terms ("AI", "Python"), and code/Markdown syntax hints — these are how Kurdish Sorani UIs conventionally handle such tokens.

## Verification

A key-by-key comparison confirmed `ku.json` now has the identical key set as `en.json` and `ar.json` (zero missing keys), valid JSON, and no unintended Latin-script words remain in translated text. The site was then walked through in the browser on the `/ku` locale:

| Page | Screenshot | Status |
|---|---|---|
| `/ku/communities` (logged out) | qa27+ series (earlier QA) | RTL + Sorani correct |
| `/ku/search` | `localhost_2026-08-13_17-47-27_2187.webp` | Placeholder, tabs, results-for query all Sorani |
| `/ku/search?q=general` (communities tab) | `localhost_2026-08-13_17-47-37_2451.webp` | "١ بابەت · ٠ ئەندام · دروستکراوە لەلایەن ThoughtDom" |
| `/ku/register` | `localhost_2026-08-13_17-47-55_2308.webp` | All labels Sorani, RTL correct |
| `/ku/communities` (logged in) | `localhost_2026-08-13_17-49-13_9721.webp` | "کۆمەڵگاکانت" section + "تۆ خاوەنیت" owner badge + "١ ئەندام" all correct |

Test data created for this verification (account `NightWanderer862`, community `TestKu`) has been purged from the database; only `WinterComet439` and the `general` community remain. The full 54-test backend suite passes against the clean database.

## Notes

The two pending items from the QA phase — the stale-navbar-after-logout cosmetic bug and the partially untranslated Arabic "Why" page — are unchanged, as you asked not to touch code without telling you first. Both are documented with screenshots in `QA_BUGHUNT_REPORT.md`.
