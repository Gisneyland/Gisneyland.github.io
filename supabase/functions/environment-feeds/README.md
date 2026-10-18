# 全球災害資料代理

後台天氣的地名搜尋使用 Open-Meteo Geocoding；預報及天文資料一律以台北時間 UTC+8 對齊場館行事曆。定位僅在已有瀏覽器授權時自動啟用，否則由使用者按下目前位置按鈕授權。位置不寫入資料庫或瀏覽器永久儲存。

USGS M2.5+ 近 24 小時地震資料由瀏覽器直接讀取；GDACS 和 NOAA Atom/RSS 缺乏瀏覽器跨來源存取，因此透過此函式讀取。這些來源分別是災害事件／衝擊評估與發布中心最新公告，並非全球完整的即時預警服務。

## 部署

在已登入 Supabase CLI 且已連結專案的環境執行：

```sh
supabase functions deploy environment-feeds
```

保留 Supabase 預設 JWT 驗證；後台登入中的 Supabase client 會附上使用者權杖。無須額外 API 金鑰、服務角色金鑰或資料庫 migration。未部署、來源失效或解析失敗時，介面會顯示無法確認，不能視作沒有警報。

函式只接受 POST/OPTIONS，不採用用戶端提供的網址；固定讀取三個公開來源，10 秒逾時、每份 XML 限 2 MB（字元上限），拒絕 DTD/ENTITY，並將同時請求合併，於執行個體內快取 60 秒。瀏覽器每 5 分鐘於分頁可見時更新，也可手動更新；超過 10 分鐘的查詢資料標示無法確認。上游公告時間可能早於查詢時間，介面分別標示兩者，不推定公告仍然有效。

## 資料來源

- [USGS](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php)：已發生的地震，不是地震預警，也不能據此判定海嘯。
- [GDACS](https://www.gdacs.org/)：全球地震、熱帶氣旋／颱風、洪水等災害衝擊評估（European Union, CC BY 4.0）。事件中心距離不是危險範圍。
- [NOAA PTWC/NTWC](https://www.tsunami.gov/)：發布中心涵蓋區域的最新海嘯公告，可能為資訊、警報或解除；以原文與當地官方避難指示為準。海嘯公告不套用事件中心距離篩選。
- [Astronomy Engine](https://github.com/cosinekitty/astronomy)：觀測日期 20:00 的行星方位、月相、日月出沒，及接續月相和全球日月食。全球食象不代表選定地點可見。

## 驗證

```sh
node --test tests/environment-feeds.test.cjs
node --check assets/js/admin-environment.js
node --check assets/js/admin-content.js
```

Node 測試以 VM 模擬 Deno handler，驗證來源限制、快取、部分失敗與方法限制；仍需在部署後驗證 Supabase gateway JWT、實際上游網路與 CORS。