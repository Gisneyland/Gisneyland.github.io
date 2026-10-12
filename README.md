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

正式收集健康資料前，請將頁面上的保存期限、管理員權限、刪除流程、資料外洩應變窗口改成組織正式政策，不要只保留範例文字。Edge Function 仍建議再加入 CAPTCHA 與 rate limit，避免公開端點被大量呼叫。

## 本地與自動檢查

```bash
bundle install
bundle exec jekyll serve
bundle exec jekyll build
```

GitHub Actions 會在每次 push 與 Pull Request 執行相同的 Jekyll build，設定檔位於 [.github/workflows/validate.yml](.github/workflows/validate.yml)。

## 管理後台

後台網址為 `/admin/`，使用 Supabase Auth 登入。問卷資料和新聞/活動管理都限 `admin_profiles` 白名單帳號使用；匿名訪客與一般登入帳號無法管理內容或讀取問卷資料。

設定第一位管理員：

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

活動頁固定開放時段依[風城部屋團隊資訊](https://hackmd.io/@HsinchuPride/Welcome)設定為每週二至週六 14:00–22:00；DGPA 辦公日曆標記的國定假日不排開放時段。假日日曆 JSON 取自 [TaiwanCalendar](https://github.com/ruyut/TaiwanCalendar)，其資料源為[政府資料開放平台的政府行政機關辦公日曆表](https://data.gov.tw/dataset/14718)，年度資料發布後由上游更新。

活動頁的「匯出 .ics」會下載從當日至目前可取得年度範圍的開放時段、國定假日、補班日，以及已上架活動；時間採用 `Asia/Taipei`。若要新增或編輯活動，需先完成上方 Supabase `site_content` migration，並由授權工作人員在 `/admin/` 上架。
