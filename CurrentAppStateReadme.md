# BizEnglish — Trạng thái hiện tại (đọc file này đầu mỗi session)

> Cập nhật lần cuối: 2026-09-01 (sau commit `16d7b29`).
> File này là "bộ nhớ dài hạn" của dự án — đọc xong là nắm được toàn bộ app, việc gì xong, việc gì còn dở, và nên làm gì tiếp. Khi làm thêm việc gì đáng kể, **cập nhật lại file này rồi commit**.

## 1. Tổng quan

**BizEnglish** — app học từ vựng/cụm từ tiếng Anh thương mại. Next.js 16 (App Router, Turbopack) + Supabase (Postgres + Auth), deploy Vercel.

| | |
|---|---|
| Production | https://biz-english-vibe.vercel.app |
| GitHub | `PoppyPham/biz-english-app` (SSH alias `github.com-PoppyPham`, key `psbjct_key` — xem `~/.ssh/config`) |
| Supabase production | `tneggjfuthhthaqfpazt.supabase.co` |
| Local dev | Next.js `npm run dev` (localhost:3000) + Supabase local qua Docker/OrbStack (`supabase start`, cổng 54321 API / 54322 DB / 54323 Studio) |
| Super admin | `psb.jct@gmail.com` — UUID production `d05d7f2f-b7f9-49fa-b64f-eba5162e08bf`, UUID local dev `26028d15-d589-477b-9840-d2af7bdf94e1` (khác nhau vì 2 DB tách biệt) — xem `lib/admin.ts` |
| Stack | Next 16.2.9, React 19.2.4, Tailwind 4, `@supabase/ssr`, `xlsx` (parse CSV/Excel), TypeScript |

Push lên `main` → Vercel tự deploy. **Thay đổi schema DB KHÔNG tự deploy** — phải tự chạy SQL trong Supabase SQL Editor (xem mục 4).

## 2. Tính năng đã có (đầy đủ)

### Auth & tài khoản
- Đăng ký/đăng nhập bằng email+password (`app/auth/*`), không cần xác nhận email (đã tắt trong Supabase settings)
- Đổi mật khẩu tại `/account` (yêu cầu nhập mật khẩu cũ để verify) — **chỉ có lối vào từ TopNav desktop (ProfileDropdown), mobile chưa có** (xem mục 5, việc còn dở)

### Học từ vựng
- **Learning Dashboard** (`/`) — trang gộp Home+Learn cũ thành 1 (đổi tên hồi giữa dự án). Hiển thị: hero cá nhân hoá, progress bar tổng, "Continue Learning" (nhảy thẳng vào phrase đang học gần nhất), lưới categories (system + Your Words + category tự tạo), tile "New category"
- **`/learn/[category]`** — danh sách phrase trong 1 category: filter (All/New/Learning/Learned/Favorites), favorite, đổi status, nút Flashcards/Quiz/Add word (nếu là owner)
- **`/phrase/[id]`** — chi tiết: định nghĩa, ví dụ (curated + user tự thêm, tối đa 5 mỗi loại), **IPA** (ưu tiên DB → auto-fetch Dictionary API → cache lại DB qua RPC `set_phrase_ipa`), nút **Listen** (audio thật ưu tiên, fallback Web Speech giọng tự nhiên hơn giọng mặc định), widget **YouGlish** (phát âm qua video thật), prev/next điều hướng, admin thấy thêm ô sửa IPA trực tiếp

### Your Words + Categories tự tạo (tính năng lõi)
- **`/words`** — user tự thêm/sửa/xoá cụm từ của riêng mình (không giới hạn số lượng), publish/unpublish ra community, chọn category khi thêm
- **`/categories`** — user tự tạo category riêng (tối đa **5** cho user thường, **admin không giới hạn**), đặt public/private, sửa/xoá (xoá thì word bên trong tự chuyển về "Your Words" chứ không mất)
- Model DB: `phrases`/`categories` đều có `owner_id` (NULL = community) + `is_public`. RLS: thấy được community + public + của mình + admin thấy hết
- Category/word tự tạo **tự động** xuất hiện đầy đủ ở Home, Games (Flashcard/Quiz chơi được `?category=<slug-tự-sinh>`), Progress — vì dùng chung bảng `phrases`/`categories`, không phải bảng riêng

### Games
- **Flashcard** (`/games/flashcard`) — lật thẻ 3D, phím tắt, đánh dấu Still Learning/Got it
- **Quiz** (`/games/quiz`) — trắc nghiệm 4 đáp án, timer 15s (tắt được), sao 0-3, share kết quả
- Cả 2 chơi được: toàn bộ, theo category, hoặc `?category=your-words`

### Progress
- `/progress` — thống kê tổng, streak ngày học, breakdown theo category (kể cả Your Words), favorites, "Keep going" gợi ý từ chưa học

### Admin — trang Management (`/admin`, chỉ super admin thấy, vào từ ProfileDropdown)
- **`/admin`** — overview: tổng phrase, tổng category hệ thống, số phrase thiếu IPA
- **`/admin/import`** — **bulk import CSV/Excel**: chọn category đích (system HOẶC category admin tự tạo, 2 nhóm riêng trong dropdown), tải template mẫu, upload file, preview (valid/invalid/duplicate + lý do từng dòng), tuỳ chọn bỏ qua trùng lặp / tự điền IPA, import theo batch 200 dòng. Từ import inherit `owner_id` theo category đích (NULL nếu system, admin's id nếu category riêng)
- Sửa IPA cho **bất kỳ** phrase nào (kể cả community) ngay trên trang `/phrase/[id]`

### Khác
- PWA icon (bong bóng "BE" xanh, tự thiết kế, `public/icon-*.png` + `apple-icon.png`)
- Chạy được trên điện thoại qua LAN (xem mục 6)

## 3. Kiến trúc / pattern quan trọng (đọc trước khi sửa)

- **Ownership model dùng chung**: `phrases` và `categories` đều có `owner_id` (uuid, NULL = hệ thống) + `is_public` (bool). Không tách bảng riêng cho "user content" — nhờ vậy mọi tính năng khác (game, progress, examples...) tự động hoạt động với nội dung do user tạo mà không cần sửa gì thêm.
- **Admin pattern**: bảng `admins` (user_id) + hàm `is_admin()` (SECURITY DEFINER, đọc bảng `admins`, bypass RLS) được gọi **trong RLS policy** của các bảng khác để cấp quyền full CRUD cho admin. `lib/admin.ts` (`ADMIN_USER_IDS`, `isAdmin()`) chỉ dùng để ẩn/hiện UI — **RLS mới là chốt bảo mật thật**, không phải check ở app.
  - ⚠️ Bài học đau: policy INSERT hay bị quên thêm `is_admin()` dù UPDATE/DELETE đã có (xảy ra với `phrases_insert_own` — sửa ở `admin-phrase-insert.sql`). Khi thêm bảng mới cho admin quản lý, nhớ thêm `is_admin()` vào **cả 4** policy select/insert/update/delete.
- **IPA cache pattern**: component `<Ipa>` ưu tiên đọc `phrases.ipa` từ DB; nếu trống mới gọi Dictionary API (`lib/dictionary.ts`, có cache + queue giới hạn 4 request đồng thời) rồi **tự ghi lại vào DB** qua RPC `set_phrase_ipa` (SECURITY DEFINER, chỉ ghi khi đang trống — an toàn cho phrase community mà user thường không có quyền UPDATE trực tiếp).
- **Import file (CSV/Excel)**: dùng chung 1 lib `xlsx` (SheetJS) cho cả 2 định dạng qua `lib/importPhrases.ts`. ⚠️ **Bài học quan trọng**: SheetJS đọc CSV nhị phân không tự nhận UTF-8 nếu thiếu BOM → làm hỏng ký tự IPA/tiếng Việt có dấu. Đã fix: CSV được decode UTF-8 tường minh (fallback Windows-1252) trước khi đưa vào SheetJS; `.xlsx`/`.xls` giữ nguyên đường nhị phân (định dạng này tự đúng UTF-8 sẵn). Nếu sau này thêm chỗ đọc file text nào khác, nhớ pattern này.
- **Migration SQL — 2 nơi, ý nghĩa khác nhau** (dễ gây lẫn lộn, đọc kỹ mục 4).

## 4. ⚠️ Trạng thái đồng bộ Local ↔ Production (QUAN TRỌNG — đọc trước khi code tiếp)

Dự án có **2 nơi chứa migration SQL**:
- `supabase/migrations/*.sql` — dùng cho **Supabase CLI local dev** (Docker/OrbStack), áp tự động khi `supabase start`/`db reset`. Được set up ở 1 session khác (không phải qua tay tôi từng bước trong hội thoại này), gồm 1 file `init.sql` gộp lớn + vài file lẻ dịch tên category.
- `supabase/*.sql` (file rời, không nằm trong `migrations/`) — được tạo **thủ công từng tính năng** trong hội thoại, và **user phải tự copy-paste chạy tay** vào Supabase SQL Editor **của production**. Đây là nguồn lịch sử thật của production.

Do 2 luồng này tách biệt, **production và local đã bị lệch**. Đã verify trực tiếp qua production REST API (anon key) ngay trước khi viết file này:

### ✅ Đã xác nhận khớp (production = local)
- Bảng `phrases`, `categories`, `user_progress`, `phrase_examples`, `user_examples`, `admins` — tồn tại đủ cột (`owner_id`, `is_public`, `ipa`...)
- RPC `is_admin()`, `set_phrase_ipa()` — chạy được
- Super admin đã seed đúng, đã tự test đăng nhập thấy ô Admin
- **IPA**: 361/361 phrase có IPA ở cả 2 nơi (`supabase/backfill_ipa_production.sql` đã chạy, xác nhận qua đếm trực tiếp)

### ❌ CHƯA khớp — cần xử lý

1. **Tên category trên production còn tiếng Việt + số thứ tự cũ**, ví dụ `"1. Giao tiếp Hàng ngày"` — trong khi local đã sạch thành `"Daily Communication"`. Migration dịch tên (`20260808185004_translate_category_names.sql`, `20260808185500_drop_category_number_prefix.sql`) nằm trong `migrations/` cho local nhưng **chưa từng chạy trên production**. → **User đang thấy tên category tiếng Việt/số thứ tự trên app thật, khác hẳn bản local.**
   - Cách sửa: viết 5 câu `UPDATE categories SET name=... WHERE slug=...` (theo slug, giống cách làm `backfill_ipa_production.sql`) rồi chạy trên production SQL Editor. Chưa làm — để dành cho session sau hoặc làm ngay nếu user muốn tên category đẹp trên production.

2. **`supabase/user-categories.sql`** (tính năng category tự tạo) — chỉ xác nhận được phần **ALTER TABLE** (thêm cột `owner_id`/`is_public`) đã chạy trên production (probe thấy cột tồn tại). **Không xác nhận được** phần RLS policies + GRANT + trigger (unique slug, giới hạn 5 category) đã chạy chưa — không test được qua anon key. → **Rủi ro: tính năng tạo category trên production có thể lỗi RLS/permission denied.**

3. **`supabase/admin-phrase-insert.sql`** (fix RLS cho phép admin insert phrase community) — **KHÔNG xác nhận được đã chạy trên production**. Đây là fix **bắt buộc** để tính năng **bulk import (`/admin/import`) hoạt động** — nếu chưa chạy, admin bấm Import trên production sẽ bị lỗi `new row violates row-level security policy`.

**→ Việc cần làm ngay (ưu tiên cao nhất, session sau nên làm trước tiên):**
```
Vào Supabase production → SQL Editor → chạy lại (an toàn, idempotent — chỉ drop+create):
  1. supabase/user-categories.sql
  2. supabase/admin-phrase-insert.sql
```
Rồi test thật trên production: tạo 1 category mới, và thử bulk import 1 file CSV nhỏ vào 1 system category — xác nhận không lỗi RLS.

## 5. Việc còn dở / backlog (chưa làm, đã bàn nhưng chưa code)

Sắp theo mức ưu tiên gợi ý:

1. **[Ưu tiên cao]** Đồng bộ production như mục 4 ở trên (2 file SQL + tên category)
2. **Mobile chưa có lối vào `/account`** — nút "Change password"/"Management" chỉ có ở `ProfileDropdown` (TopNav desktop). `BottomNav` (mobile) không có entry point nào tới `/account`. Cần thêm 1 nút/tab hoặc icon settings ở mobile.
3. **Trang "Community Words / Explore"** — `is_public` đã có sẵn trên cả `phrases` và `categories`, user đã publish được, nhưng **chưa có trang nào để duyệt/xem** nội dung public của người khác. Hiện tại publish chỉ có tác dụng cho content đó lọt vào pool "tất cả" của quiz/flashcard qua RLS, chưa có khám phá trực quan.
4. **Dọn schema SQL trùng lặp** — cân nhắc gộp lại `supabase/*.sql` rời (đã áp hết lên production tính đến thời điểm bài viết, trừ 2 file ở mục 4) thành migration thống nhất, để tránh tình trạng lệch local/production tái diễn. Có thể là: đồng bộ `migrations/` với đúng những gì production đang có, rồi từ đó về sau **chỉ dùng 1 nguồn** (khuyến nghị: chuyển hẳn sang Supabase CLI (`supabase db push`) làm nguồn thật cho cả production, thay vì copy-paste tay vào SQL Editor).
5. **README.md** (khác với file này) — vẫn là bản mặc định `create-next-app`, chưa mô tả gì về dự án.
6. **Kiếm tiền** (đã bàn kỹ, chưa code gì):
   - Nút "Upgrade to Plus" trong `CategoryManager.tsx` (khi user thường chạm giới hạn 5 category) hiện là **placeholder disabled**, chưa gắn thanh toán thật
   - Khuyến nghị đã thống nhất: bắt đầu bằng **nút Donate** (Ko-fi/Buy Me a Coffee) — rẻ, nhanh, không rủi ro pháp lý
   - Về lâu dài: **Freemium subscription** qua **LemonSqueezy hoặc Paddle** (Merchant of Record — vì Stripe không hỗ trợ trực tiếp Việt Nam) là hướng bền vững nhất
   - Lưu ý quan trọng: khi bắt đầu thu tiền, **bắt buộc nâng cấp Vercel Pro + Supabase Pro** (gói Hobby/Free cấm dùng thương mại) — chi phí tối thiểu ước ~$45/tháng

## 6. Chạy trên điện thoại qua LAN (đã setup, hoạt động tốt)

Vì Vercel/Supabase free tier chậm, đã setup chạy app local trên Mac rồi truy cập từ điện thoại qua Wifi nhà:
- `.env.local` trỏ Supabase qua **IP LAN của Mac** (không phải `127.0.0.1` — điện thoại sẽ tự gọi vào chính nó nếu để vậy)
- `next.config.ts` có `allowedDevOrigins` chứa IP đó (Next 15.3+/16 mặc định chặn cross-origin dev request)
- Firewall macOS đã cho phép `node` + `OrbStack` nhận kết nối đến

**Điện thoại cùng Wifi** → mở `http://<ip-lan-cua-Mac>:3000`.

⚠️ **IP có thể đổi** khi Wifi reconnect (DHCP). Nếu điện thoại không vào được nữa: chạy `ipconfig getifaddr en0` trên Mac lấy IP mới → cập nhật vào **cả 2 chỗ**: `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`) và `next.config.ts` (`allowedDevOrigins`) → restart `npm run dev`. Chỉ gõ lại IP mới trên trình duyệt điện thoại là **không đủ** — dòng "Network: ..." mà `next dev` in ra chỉ là URL trang web, không tự update cấu hình Supabase.

## 7. Vài lưu ý vận hành khác

- **Git push**: remote dùng SSH alias riêng cho account PoppyPham (khác account SSH mặc định trên máy) — xem `~/.ssh/config`, host `github.com-PoppyPham`.
- **Local Supabase**: Studio UI tại `http://localhost:54323` để xem bảng/chạy SQL/xem auth users mà không cần `psql`.
- **User test local**: `psb.jct@gmail.com` / `devpass123` (đã set thủ công trong DB local, không liên quan mật khẩu production).
- **Repo là public** — không commit file `.env.local`/secret thật (đã có `.gitignore` + `.env.example` làm mẫu).
