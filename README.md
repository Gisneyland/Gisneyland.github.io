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
- 活動地點可搜尋、點選地圖、拖曳標記或輸入經緯度；Photon 查詢失敗時仍可保留手動座標，使用 OpenStreetMap 圖磚。
- 店面圖示可編輯固定星期時段或單日休館／開放例外；每日至多一段營業區間，跨午夜需分兩日設定。「恢復預設」會還原原始週規則，或移除單日例外。公開備註會用於前台及匯出，勿填內部敏感資料。
- 前台活動詳情及 ICS 共用活動時間、座標與營業例外；缺少政府日曆年份會提示假日可能不完整。

測試：`node --test tests/calendar-model.test.cjs tests/environment-feeds.test.cjs`。SQL 的實際套用與線上權限仍需在 Supabase 驗證；本機瀏覽器寫入測試使用記憶體替身，未修改真實活動或營業資料。

所有單元測試可執行 `node --test tests/*.test.cjs`。按鈕與後台初始化的瀏覽器回歸測試使用 Node.js 22+ 與本機 Chromium：先執行 `bundle exec jekyll build`，再執行 `CHROMIUM_BIN=/usr/bin/chromium node --test tests/*.test.cjs`（請依環境調整 Chromium 路徑）。未設定 `CHROMIUM_BIN` 時會略過瀏覽器測試。測試使用替身帳號並封鎖外部服務，不會存取或修改正式 Supabase 資料。
