# PDF Organizer (Client-only)

ブラウザだけで動作する PDF 編集ツールです。  
アップロードした PDF は端末内で処理され、サーバーに送信しません。

## 機能

- ページ並べ替え（ドラッグ&ドロップ）
- ページ選択 / 全選択 / 選択解除
- 選択ページ削除
- 並べ替え後PDFを書き出し
- 選択ページのみ書き出し
- 1ページずつ分割ZIP
- 範囲指定分割ZIP（例: `1-3,4-6,7`）
- 見開き変換（2ページを横並びで1ページ化）
- 見開きの綴じ方向切替（左綴じ / 右綴じ）
- 生成PDFをブラウザPDF Viewerで直接表示

## ローカル実行

```bash
npm install
npm run dev
```

## Vercel デプロイ

1. GitHub に push
2. Vercel でこのリポジトリを Import
3. Framework Preset は `Vite`（`vercel.json`で設定済み）
4. Deploy

## 注意

- 大きい PDF は端末メモリを多く消費します。
- 画像化済みPDFの再保存では、元PDFの最適化情報は保持されません。
