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

1. 在 Supabase Dashboard 的 SQL Editor 執行 [supabase/schema.sql](supabase/schema.sql)。這個檔案會建立資料表、限制 JSON 大小，並只允許 `anon` 新增資料；匿名使用者不能查詢、修改或刪除資料。

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

後台網址為 `/admin/`，使用 Supabase Auth 登入。後台只提供已列入 `admin_profiles` 白名單的帳號讀取問卷資料，匿名訪客與一般登入帳號都不能讀取。

後台登入頁可申請帳號。申請者需完成 Supabase 電子郵件驗證（若專案有啟用），但帳號不會自動取得後台權限；管理員審核身分後，仍需將使用者加入 `admin_profiles`。忘記密碼可在登入頁寄送重設連結，連結會返回 `/admin/` 設定新密碼。

先在 Supabase Dashboard 的 `Authentication > URL Configuration` 將正式後台網址 `https://gisneyland.github.io/admin/` 加入 `Redirect URLs`；本機測試時也加入 `http://127.0.0.1:4000/admin/`。請確認 `Authentication > Email Templates` 的確認信與密碼重設信已啟用並可寄送。

設定第一位管理員，或核准一筆帳號申請：

1. 使用者從 `/admin/` 申請帳號後，在 Supabase Dashboard 的 `Authentication > Users` 確認帳號與電子郵件驗證狀態。第一位管理員可直接在此建立 Email/Password 使用者。
2. 複製該使用者的 UUID，在 SQL Editor 執行：

```sql
insert into public.admin_profiles (user_id)
values ('YOUR_AUTH_USER_UUID');
```

3. 將 [supabase/schema.sql](supabase/schema.sql) 完整執行一次，確認 `admin_profiles` 與問卷的 RLS policy 已建立。
4. 開啟 `https://gisneyland.github.io/admin/` 登入。後台支援搜尋、語言篩選、重新整理與單筆詳細檢視。

後台不提供匿名讀取、資料修改或刪除功能。健康資料屬敏感資訊，請只把必要的工作人員加入白名單，並定期檢查 Supabase Auth 使用者與 `admin_profiles`。移除 `admin_profiles` 中的使用者即可撤銷後台讀取權限。
