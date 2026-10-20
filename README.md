# 風城部屋網站

這是使用 GitHub Pages 建立的靜態網站，主要提供新竹在地 LGBTQ+ 文化活動與健康資源資訊。

## 🌐 網站連結
[https://gisneyland.github.io/](https://gisneyland.github.io/)

## ✨ 特色
- 彩虹漸層導覽列
- Google Translate 語言選單（支援東南亞移工常用語言：印尼、泰語、越南、緬甸、菲律賓、高棉、孟加拉）
- 暗黑 / 明亮 / 自動 模式切換
- 卡片風格內容版型，提升閱讀舒適度

## 🛠️ 本地測試
Windows 建議使用 RubyInstaller 3.3 或 3.4 的 **Ruby+Devkit** 版本；若使用較新的 Ruby 版本，請先確認 MSYS2/Devkit 已完成安裝，否則部分 Gem 會需要本機編譯而失敗。

```bash
gem install bundler
bundle install
bundle exec jekyll serve
```

網站預設會在 `http://localhost:4000` 啟動。提交前可先執行：

```bash
bundle exec jekyll build
```

## Supabase 問卷設定

問卷支援兩種資料入口：部署 Edge Function 後的安全入口，以及尚未部署時的暫時直接寫入模式。正式環境應使用 Edge Function；`service_role` key 只能存在 Supabase 的 server-side secrets，絕對不可放入網站。

1. 在 Supabase Dashboard 的 SQL Editor 執行最新版 [supabase/schema.sql](supabase/schema.sql)。除了問卷資料表，也會建立新聞/活動共用的 `site_content` 表與 RLS：訪客只能讀取已上架內容，只有 `admin_profiles` 中的工作人員能新增、編輯、刪除與切換上架狀態。匿名使用者只能新增問卷，不能查詢、修改或刪除問卷資料。

2. 到 Supabase Dashboard 的 `Project Settings > API`，複製 `Project URL` 與 `Publishable key`（舊介面可能顯示為 `anon public` key），填入 [assets/js/supabase-config.js](assets/js/supabase-config.js)。這個 key 可以公開，但不要放 `service_role` key。
3. 正式環境部署 Edge Function：

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set ALLOWED_ORIGIN=https://gisneyland.github.io
supabase functions deploy submit-questionnaire --no-verify-jwt
```

Edge Function 會使用 Supabase 自動提供的 `SUPABASE_SERVICE_ROLE_KEY`，驗證資料格式與請求來源後才寫入資料表。部署後將 `SUPABASE_FUNCTION_NAME` 設為 `submit-questionnaire`，再部署網站。`ALLOWED_ORIGIN` 必須填實際網站網址，不要保留 `*`。

4. 送出測試問卷，到 `Table Editor > questionnaire_responses` 確認資料；測試完成後，刪除測試資料。

若尚未部署 Edge Function，設定檔中的函式名稱留空即可使用暫時直接寫入模式。此模式容易被機器人灌資料，只適合開發測試。

正式使用前設定 Resend 郵件：

1. 在 Resend 驗證組織實際擁有的寄件網域，並依 Resend 提供的 DNS 記錄完成網域驗證。選用該網域下的寄件地址，例如 `no-reply@your-verified-domain`。
2. 在 Supabase `Authentication > Emails > SMTP Settings` 啟用自訂 SMTP：Host `smtp.resend.com`、Port `465`、Username `resend`、Password 填 Resend API key，寄件人使用已驗證的寄件地址。SMTP 密碼/API key 只輸入 Supabase Dashboard，不可提交到 Git。

正式收集健康資料前，請將頁面上的保存期限、管理員權限、刪除流程、資料外洩應變窗口改成組織正式政策，不要只保留範例文字。公開問卷端點仍建議加入 rate limit，避免大量機器人提交。

## 本地與自動檢查

```bash
bundle install
bundle exec jekyll serve
bundle exec jekyll build
```

GitHub Actions 會在每次 push 與 Pull Request 執行相同的 Jekyll build，設定檔位於 [.github/workflows/validate.yml](.github/workflows/validate.yml)。

## 管理後台

後台網址為 `/admin/`，使用 Supabase Auth 登入。問卷資料和新聞/活動管理都限 `admin_profiles` 白名單帳號使用；匿名訪客與一般登入帳號無法管理內容或讀取問卷資料。

後台登入頁可申請帳號。申請者需完成 Supabase 電子郵件驗證（若專案有啟用），但帳號不會自動取得後台權限；管理員審核身分後，仍需將使用者加入 `admin_profiles`。忘記密碼可在登入頁寄送重設連結，連結會返回 `/admin/` 設定新密碼。

1. 先在 SQL Editor 執行最新版 [supabase/schema.sql](supabase/schema.sql)，建立/更新問卷、管理員權限與 `site_content` 內容表。
2. 在 Supabase Dashboard 的 `Authentication > Users` 建立 Email/Password 使用者，並完成 Email 驗證（依專案設定而定）。
3. 複製該使用者的 UUID，在 SQL Editor 執行：

```sql
insert into public.admin_profiles (user_id, screener_number)
values ('YOUR_AUTH_USER_UUID', 'YOUR_ASSIGNED_SCREENER_NUMBER');
```

4. 開啟 `https://gisneyland.github.io/admin/` 登入。後台支援篩檢員編號綁定、問卷搜尋/篩選，以及新聞與活動的新增、編輯、刪除和上架管理。

問卷資料不提供匿名讀取、修改或刪除；已核准的工作人員仍只能更新自己帳號的篩檢員編號。新聞與活動公開端只讀取已上架項目。健康資料屬敏感資訊，請只把必要的工作人員加入白名單，並定期檢查 Supabase Auth 使用者與 `admin_profiles`。

## 活動行事曆與 ICS

活動頁預設開放時段依[風城部屋團隊資訊](https://hackmd.io/@HsinchuPride/Welcome)設定為每週二至週六 14:00–22:00；DGPA 辦公日曆標記的國定假日不排開放時段。套用排程 migration 後，可在後台編輯固定週時段與單日例外；單日例外優先於固定時段及國定假日。假日日曆 JSON 取自 [TaiwanCalendar](https://github.com/ruyut/TaiwanCalendar)，其資料源為[政府資料開放平台的政府行政機關辦公日曆表](https://data.gov.tw/dataset/14718)，年度資料發布後由上游更新。

活動頁的「匯出 .ics」會下載從當日至目前可取得年度範圍的開放時段、國定假日、補班日，以及已上架活動；時間採用 `Asia/Taipei`。若要新增或編輯活動，需先完成上方 Supabase `site_content` migration，並由授權工作人員在 `/admin/` 上架。

後台另提供全球地名搜尋、瀏覽器授權定位、七日天氣、農曆節氣，以及月相、行星方位與天象計算；顯示時間一律採台北時間 UTC+8。全球災害區分 USGS 地震事件、GDACS 衝擊評估與 NOAA 海嘯公告，不等同全球完整即時預警。GDACS／NOAA 須另外部署只讀代理函式，詳見 [environment-feeds 部署與資料來源說明](supabase/functions/environment-feeds/README.md)。未連線或過期時顯示無法確認，不代表沒有警報；應以當地政府避難指示為準。

後台「新聞與活動」以共用工具列篩選全部／新聞／活動，並可切換行事曆或內容管理工作區。行事曆保留月、週、日、列表模式；內容管理提供編輯、發布開關與更多選單中的刪除操作。新增與編輯在原生對話框進行，手機為全螢幕，關閉或 Esc 會確認未儲存變更。天氣、農曆、天文及災害內容收納在環境資訊抽屜，收合後仍保留地點、今日天氣及災害來源連線摘要。所有資料寫入權限及刪除確認維持不變。

### 排程資料更新

既有專案請先在 Supabase SQL Editor 執行 [202610180001_calendar_scheduling.sql](supabase/migrations/202610180001_calendar_scheduling.sql)；新專案需先執行 schema.sql，再執行此 migration。這不會重建活動資料，既有日期活動維持整天。新增活動時間與座標、營業設定的寫入必須在 migration 後才能使用，讀取舊活動仍相容。

- 週檢視為週日至週六逐日分組的新聞／活動清單，沒有時間軸；週次採週日起算，例如 2026/10/18 為第 43 週。
- 日檢視顯示完整 00:00–24:00、整天新聞／活動、現在時間線與過去時段背景遮罩；活動文字不套模糊。
- 清單預設定位現在附近，可向上／下延伸日期範圍，每次 30 天，支援回顧與未來排程。內容以每頁 500 筆讀取，避免只呈現單次查詢上限內的資料。
- 「現在」按鈕位於前後按鈕中間，依模式顯示目前月份、週次、日期或時分；點標題可選 1900–2200 年。
- 活動可設整天（結束日期含當日）或指定起訖時間（結束時間不含在範圍內），支援跨午夜；全部以 Asia/Taipei 儲存與顯示。
- 活動地點與後台常用篩檢地點使用 Photon 搜尋，無結果、逾時或失敗時改用 OpenStreetMap Nominatim（僅在主動搜尋或地圖選點時查詢，備援請求間隔至少一秒）。仍可點選地圖、拖曳標記；活動地點另可輸入經緯度，服務離線時保留手動座標，使用 OpenStreetMap 圖磚。
- 後台「常用地點與時段」可刪除最後一筆安排並儲存，表示沒有固定篩檢排程或休假；重新登入仍維持空白，問卷不會預填排程地點。需要時可再新增安排。
- 店面圖示可編輯固定星期時段或單日休館／開放例外；每日至多一段營業區間，跨午夜需分兩日設定。「恢復預設」會還原原始週規則，或移除單日例外。公開備註會用於前台及匯出，勿填內部敏感資料。
- 前台活動詳情及 ICS 共用活動時間、座標與營業例外；缺少政府日曆年份會提示假日可能不完整。

測試：`node --test tests/calendar-model.test.cjs tests/environment-feeds.test.cjs`。SQL 的實際套用與線上權限仍需在 Supabase 驗證；本機瀏覽器寫入測試使用記憶體替身，未修改真實活動或營業資料。

所有單元測試可執行 `node --test tests/*.test.cjs`。按鈕與後台初始化的瀏覽器回歸測試使用 Node.js 22+ 與本機 Chromium：先執行 `bundle exec jekyll build`，再執行 `CHROMIUM_BIN=/usr/bin/chromium node --test tests/*.test.cjs`（請依環境調整 Chromium 路徑）。未設定 `CHROMIUM_BIN` 時會略過瀏覽器測試。測試使用替身帳號並封鎖外部服務，不會存取或修改正式 Supabase 資料。

## 前台網站編輯器（管理員）

**部署必要步驟：**先套用 `schema.sql` 與既有工作人員 migrations，再在 Supabase SQL Editor 執行 [202610200001_site_editor.sql](supabase/migrations/202610200001_site_editor.sql)。這次新增功能以 migration 部署，單獨重跑 `schema.sql` 不會安裝編輯器資料表或 RPC。不需要新套件或 service-role 瀏覽器金鑰。

在任一公開頁面使用右上角工作人員登入。只有 `admin_profiles` 中 `account_role = administrator`、`approval_status = approved` 且已記錄 `privacy_consent_at` 的帳號，會看到登入圖示旁的編輯按鈕；一般篩檢員即使有內容管理權限也不可使用。管理後台 `/admin/` 不可透過此工具修改。

- 「現有文字與連結」可修改既有標題、內文、混合段落中的文字節點與連結；清空文字即移除該文字。使用位置清單選取項目，保留原本巢狀標記與互動。
- 「現有區段、巢狀卡片與排序」提供同父層上／下移、刪除／恢復；首頁及各公開頁面原有區段與巢狀卡片皆可選取，不只支援新增內容。
- 「新增內容區塊」可在既有區段或卡片容器新增、更新、排序、刪除純文字標題、內文與選填連結；新增區塊放在指定容器末端，區塊排序決定同容器新增項目的先後。既有欄數、色彩與樣式仍由網站 CSS 決定，此工具不提供任意 HTML/CSS/JavaScript。
- 「全站主要／更多導覽」支援兩區導覽項目新增、修改、排序、刪除；「更多」與回頂端按鈕保留。既有導覽連結保留原節點、圖示及響應式樣式。
- **儲存草稿 → 儲存並預覽 → 離開預覽／關閉 → 重新開啟 → 發布已儲存草稿**。預覽先儲存私人草稿，僅目前管理員瀏覽器可見，不會向訪客讀取草稿。關閉會恢復已發布版面；草稿仍可重開。頁面選單先儲存目前頁面及導覽草稿，再前往另一頁繼續編輯。發布一次只原子更新「目前頁面＋全站導覽」，其他頁面草稿需分別發布。
- 多人同時編輯以版本號防止覆寫；收到版本衝突請重新整理，重新檢查其他管理員的最新草稿。未按「套用」的欄位不屬於草稿；已套用未儲存的修改在離頁時提示。
- 「草稿還原原始版面」只還原目前頁面（導覽不變），仍須儲存與發布。原始碼結構改版後，無法對應的舊路徑／內容指紋會略過，請重新檢查並編輯；本工具不建立新網址或刪除實體 GitHub Pages 頁面。

**保護範圍：**問卷與表單、輸入控制、行事曆、動態消息列表、即時狀態、工具按鈕不會擷取為編輯內容；包含這些工具的區段不能刪除。整個區段排序僅移動原 DOM 節點，保留事件、表單值與動態資料；新聞／活動請使用既有後台。編輯器只保存結構化文字與允許的連結（站內 `/`、`#`、`?`、HTTP(S)、mailto、tel），不保存 DOM HTML、登入資訊、使用者回答或健康資料。**勿在公開內容草稿輸入任何個資／健康資料**，發布內容會公開。

`site_editor_drafts` 只有核准並同意個資告知的管理員可讀；`site_editor_publications` 才可匿名讀取。資料表不授予瀏覽器直接寫入，儲存與發布 RPC 均再次檢查管理員資格、驗證結構、使用固定 `search_path`，並在交易中更新頁面與導覽。草稿不存於 localStorage/sessionStorage；登出立即清除編輯介面及記憶體中的草稿，忽略過期請求並恢復已發布版面。尚未安裝 migration／連線失敗時，靜態網站正常顯示，管理員開啟編輯器會收到 migration 提示。

測試：`CHROMIUM_BIN=/usr/bin/chromium node --test tests/site-editor.test.cjs`（Node 22+；包含本機替身服務的 Chromium 流程，不接觸正式 Supabase）。SQL 交易、角色與 RLS 測試位於 `tests/site-editor-database.sql`，**只能在拋棄式測試資料庫**執行，需安裝 migration、提供 `auth.uid()`，並準備註解所述的管理員／篩檢員／未同意管理員 fixture；測試會 rollback。
