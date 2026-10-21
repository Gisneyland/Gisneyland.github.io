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

### 問卷照片壓縮與私人儲存

- 照片在瀏覽器本機轉為 JPEG、移除 EXIF／定位資訊，維持比例且不放大；長邊最多 1280 px，依品質與尺寸逐步壓縮，**每張不超過 500,000 bytes（500 KB）**，不是強制填滿固定檔案大小。請確認預覽仍可辨識試劑結果。原檔最多 25 MB；瀏覽器無法解碼的 HEIC 等格式請先轉成 JPEG／PNG。
- 壓縮中不可送出；處理失敗需重新選圖或按「移除照片」。兩張照片合計最多約 1 MB，可降低行動網路流量及 Edge Function 請求大小。
- 照片必須經 `submit-questionnaire` 上傳至 **私人** `screening-test-photos` bucket，不可改用公開的 `site-editor-media`。更新前端後，亦請重新部署此 Edge Function（指令同上），以套用所有照片先驗證再上傳的處理，避免第二張照片無效時留下第一張孤兒檔案。上傳不覆寫既有檔案，且設為不快取；資料庫寫入或上傳失敗時會嘗試清理已上傳照片。
- 程式庫中的 bucket 設定為私人、上限 2,621,440 bytes，僅接受 JPEG／PNG／WebP；函式每張上限 2,500,000 bytes、multipart 上限 6,000,000 bytes。保留舊限制是為了相容尚未更新的頁面，不需為壓縮功能提高 bucket 上限或開放匿名寫入。既有照片不會自動重新壓縮。
- **線上確認：**本次檢查依據版本庫設定，未連線查閱正式 Supabase。請在 Dashboard 的 Storage 確認 bucket 已存在、Public 關閉、大小及 MIME 限制符合上述設定，並確認工作人員 migrations 的讀取權限已套用；勿為此重跑會覆蓋權限的舊 schema。若 bucket 尚未建立，先依既有部署流程安裝 schema 與後續 migrations。壓縮不能修復缺少 bucket、函式未部署、RLS 或儲存空間配額問題。
- 定期依組織保存期限清理問卷及對應物件；刪除資料表紀錄不會自動刪除 Storage 照片。應透過 Storage API 清理，不要直接刪除 `storage.objects` 中繼資料；清理失敗需由管理員追蹤，避免長期累積無主檔案。

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

後台與前台共用 `site-mode` 主題偏好，頁面開啟時即套用亮色／暗色／自動模式；登入區、管理工作區、狀態標籤與行事曆一併適配。後台主題切換按鈕可切換亮／暗色，另有重設為「自動」的按鈕；自動模式即時跟隨作業系統設定，其他分頁變更主題偏好也會同步套用。

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

**部署必要步驟：**先套用 `schema.sql` 與既有工作人員 migrations，再在 Supabase SQL Editor 依序執行 [202610200001_site_editor.sql](supabase/migrations/202610200001_site_editor.sql)、[202610200002_site_editor_rich.sql](supabase/migrations/202610200002_site_editor_rich.sql)、[202610200003_site_editor_media.sql](supabase/migrations/202610200003_site_editor_media.sql)、[202610200004_site_editor_components.sql](supabase/migrations/202610200004_site_editor_components.sql)。最後一份擴充既有文件驗證器，允許按鈕、圖示、Logo 及既有圖片等受限屬性，不重設草稿或已發布內容，不改變 RLS／發布權限。單獨重跑 `schema.sql` 不會安裝編輯器資料表、富文字／元件驗證或素材上傳權限。不需要 service-role 瀏覽器金鑰。

在任一公開頁面使用右上角工作人員登入。只有 `admin_profiles` 中 `account_role = administrator`、`approval_status = approved` 且已記錄 `privacy_consent_at` 的帳號，會看到登入圖示旁的編輯按鈕；一般篩檢員即使有內容管理權限也不可使用。管理後台 `/admin/` 不可透過此工具修改。

- 按登入旁的鉛筆進入就地編輯；旁邊提供復原、重做與儲存。精簡浮動操作列直接提供頁面切換、儲存、預覽、發布、還原已發布及結束編輯，不再另開「網站微調」設定視窗，也不顯示文字／節點識別碼清單。再次按鉛筆或關閉按鈕結束編輯，回到已發布版面。
- 浮動操作列、導覽編輯、文字工具列及元件屬性欄位沿用網站亮／暗色主題；新增按鈕的四種預設樣式、圖示與 Logo 也與頁面主題一致。
- 點擊網站文字直接修改；選取文字後顯示隨捲動定位的樣式工具列，提供標題、段落、引文、編號／列點、粗體、斜體、底線、螢光筆、字色、上下標及連結。混合段落保留原有巢狀標記與互動，僅修改個別文字節點；問卷、登入、行事曆等功能性控制項受保護。
- 點選元件後使用其下方「＋」新增段落、卡片、圖片、音訊、影片、表格或程式碼／數學／樂譜／流程圖／Markdown 區塊。長按元件再拖曳可調整同一容器順序；浮動工具亦提供上移、下移及刪除，鍵盤操作不必拖曳。空白文字或語法內容按 Backspace／Delete 可移除，輸入法選字期間不會觸發刪除；媒體可經長按後的刪除操作移除，復原可找回草稿內容。
- 「＋」亦可新增按鈕、Material 圖示與 Logo；點選元件的「編輯元件屬性」修改允許的文字／連結、按鈕預設樣式、Material 圖示名稱或圖片／Logo 網址與替代文字。既有靜態圖片、圖示與連結式按鈕也可就地修改、排序與刪除，操作可復原；問卷、登入、行事曆、工具列等功能按鈕及其圖示不開放移除。不接受任意 HTML、SVG 或 CSS。
- 原生 `<button>` 預設視為可能帶有程式行為，保持受保護；只有開發者已確認沒有功能性事件、並在原始碼明確標記 `data-site-editor-static="true"` 的靜態按鈕才可編輯。編輯器不會自行推測或解除功能按鈕保護。
- 表格以 Tab 分欄、換行分列；語法區塊提供來源編輯與即時預覽，程式碼只顯示、不執行。內建安全預覽支援常用 LaTeX 分數／根號／上下標、單聲部 ABC 樂譜、Mermaid 流程圖及 Markdown 基本文字／清單／連結等子集；不是完整 TeX、ABC 或 Mermaid 引擎，未支援的語法保留原文並提示，不載入或執行使用者 HTML／JavaScript。
- 媒體可貼上有權使用的公開網址、選擇網站現有媒體，或上傳本機 PNG、JPEG、WebP、GIF、MP3、OGG、WAV、MP4、WebM（每檔最多 10 MB）。外部開源素材請先取得檔案網址並確認授權，編輯器不會自動搜尋或授權第三方圖庫。**上傳檔案即為公開素材，不受私人草稿保護**；上傳前會再次確認。新素材使用獨立 `site-editor-media` bucket，只有合格管理員可新增，不存取私人問卷照片；刪除草稿元件不會刪除已上傳檔案。
- 編輯模式下直接點選網站導覽連結，就會在導覽列旁顯示文字、網址、Material 圖示、Logo／圖片網址、替代文字與排序／刪除操作，不會跳頁。「導覽 ＋」可切換「主要導覽／更多導覽」並新增項目，即使該區已清空仍可新增；既有圖示與圖片會預填，清空對應欄位可移除該視覺元素。按「套用至草稿」才修改導覽，刪除會確認，所有操作都可復原／重做。「更多」與回頂端按鈕保留；既有連結保留原節點及響應式樣式，不透過刪除導覽移除實體頁面。圖片只接受安全公開網址，不接受原始 SVG／HTML。
- 導覽文件可選欄位為 `icon`、`src`、`alt`；省略視覺欄位表示保留原始元素，`icon: ""`／`src: ""` 才明確移除圖示／Logo。帶有程式處理或互動語意的來源導覽控制項不納入編輯，「更多」、登入及其他功能按鈕不受導覽 CRUD 影響。
- **儲存草稿 → 預覽 → 離開預覽／結束編輯 → 重新開啟 → 發布已儲存草稿**。預覽先儲存私人草稿，僅目前管理員瀏覽器可見，不會向訪客讀取草稿。進入預覽會隱藏浮動編輯操作，手機也能查看完整草稿頁面；固定預覽工具列可「重新開啟編輯器」（保留預覽）或「離開預覽」。工具區的編輯按鈕也可保留預覽重新編輯。結束編輯會恢復已發布版面；草稿仍可重開。頁面選單先儲存目前頁面及導覽草稿，再前往另一頁繼續編輯。發布一次只原子更新「目前頁面＋全站導覽」，其他頁面草稿需分別發布。
- 多人同時編輯以版本號防止覆寫；收到版本衝突請重新整理，重新檢查其他管理員的最新草稿。就地文字在離開焦點或儲存時寫入草稿。未儲存修改在離頁時提示；復原／重做只在目前登入工作階段保留。
- 「還原已發布」經確認後重新讀取**目前已發布的頁面與全站導覽**，並重新檢查管理員資格及頁面／導覽草稿版本，不是還原成最初的原始碼或保留舊導覽。沒有已發布紀錄才以靜態頁面／導覽為準。還原只修改記憶體內私人草稿，可復原／重做，**不會立即儲存、發布或改動公開內容**；連線失敗、權限撤銷或草稿版本衝突不套用還原，登出／切換帳號後也不接受逾期結果。之後仍須明確儲存與發布才會影響訪客。
- 原始碼結構改版後，無法對應的舊路徑／內容指紋會略過，請重新檢查並編輯；支援既有目錄式公開路徑及 `/404.html` 等靜態 HTML 頁面，但本工具不建立新 Jekyll 檔案／網址，也不刪除實體 GitHub Pages 頁面。

**保護範圍：**問卷與表單、輸入控制、行事曆、動態消息列表、即時狀態、工具按鈕不會擷取為編輯內容；包含這些工具的區段不能移動或刪除。靜態區段排序僅移動原 DOM 節點，受保護工具固定在原位置，保留事件、表單值與動態資料；新聞／活動請使用既有後台。編輯器只保存結構化文字、允許的樣式／Material 圖示名稱、媒體與替代文字、語法來源及連結（站內 `/`、`#`、`?`、HTTP(S)、mailto、tel；媒體僅限 HTTP(S) 或站內絕對路徑），不保存 DOM HTML、登入資訊、使用者回答或健康資料。**勿在公開內容草稿輸入任何個資／健康資料**，發布內容會公開。

`site_editor_drafts` 只有核准並同意個資告知的管理員可讀；`site_editor_publications` 才可匿名讀取。資料表不授予瀏覽器直接寫入，儲存與發布 RPC 均再次檢查管理員資格、驗證結構、使用固定 `search_path`，並在交易中更新頁面與導覽。草稿不存於 localStorage/sessionStorage；登出或切換帳號立即清除編輯介面及記憶體中的草稿，忽略過期請求並恢復已發布版面。同一管理員的例行登入權杖更新會重新確認資格，但成功時保留未儲存草稿與預覽；重新確認發現權限撤銷或失敗時立即清除編輯狀態。尚未安裝 migration／連線失敗時，靜態網站正常顯示，管理員開啟編輯器會收到 migration 提示。

測試：先執行 `bundle exec jekyll build`，再執行 `CHROMIUM_BIN=/usr/bin/chromium node --test tests/site-editor*.test.cjs tests/site-interactions.test.cjs`（Node 22+；包含就地元件、導覽、還原、權限與預覽的本機替身服務 Chromium 流程，不接觸正式 Supabase）。SQL 交易、角色與 RLS 測試位於 `tests/site-editor-database.sql`，元件欄位驗證位於 `tests/site-editor-components-database.sql`；**只能在拋棄式測試資料庫**執行，需安裝 migration、提供 `auth.uid()`，並準備註解所述的管理員／篩檢員／未同意管理員 fixture；測試會 rollback。

完成 migrations 後，以具備測試表寫入權限的帳號執行元件 SQL 驗證；`DISPOSABLE_DATABASE_URL` 必須指向可丟棄的本機／測試 PostgreSQL，**不可指向正式環境**：

```bash
psql "$DISPOSABLE_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/site-editor-components-database.sql
```
