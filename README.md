# 研究者タイプ診断

大阪大学まちかね祭のヒューマンウェアイノベーション学位プログラム（HWIP）イベントで使用する、静的な日本語Webサイトです。

## 構成

- `index.html`: スタート画面、9問の診断、結果画面、参加意向の選択
- `style.css`: スマートフォン優先の画面スタイル
- `script.js`: 質問、採点、タイプ判定、結果表示
- `collection.js`: 匿名データのローカル保持とApps Scriptへの送信
- `config.js`: Apps Scriptの保存用URL・統計用URL
- `stats.html` / `stats.js` / `stats.css`: 会場表示用の集計画面
- `backend/Code.gs`: Google Apps Script側の保存・集計処理
- `assets/images/`: ロゴと8種類のキャラクター画像
- `tests/`: 採点、保存、送信処理のNode.jsテスト

ビルドツールやフレームワークは使用していません。`index.html` と `stats.html` は、同じディレクトリ構成のままGitHub PagesやHWサーバーへ配置できます。URLは相対パスで参照しています。

## 診断内容

9問の回答から、次の3軸を3〜18点で算出します。

- I/C: 個人 / 協働
- P/E: 計画 / 試行錯誤
- F/A: 原理追究 / 社会応用

各軸の高い側を組み合わせて、`IPF`、`IPA`、`IEF`、`IEA`、`CPF`、`CPA`、`CEF`、`CEA` の8タイプを判定します。質問の表示順は毎回ランダムですが、採点は元の質問番号に対応して行います。

## 匿名データの保存

診断結果の保存は任意の参加意向と同じ匿名レコードにまとめます。氏名、メールアドレス、学生番号、所属、個別回答、IPアドレス、User-Agentはサイトから送信しません。

Google Sheetsの最終的な列は次の7列です。

| 列 | 内容 |
| --- | --- |
| `timestamp` | Apps Scriptが保存時に付ける時刻 |
| `submissionId` | ブラウザで生成する匿名UUID。重複送信の判定に使用 |
| `typeCode` | 8タイプのコード |
| `icScore` | I/C軸の3〜18点 |
| `peScore` | P/E軸の3〜18点 |
| `faScore` | F/A軸の3〜18点 |
| `attendance` | `yes`（行くと思う！）、`no`（行かないかも…） |

参加意向は結果表示前の選択画面で取得し、選択しなくても診断結果は表示できます。後から選択した場合は同じ `submissionId` の行の `attendance` だけが更新されます。Apps Script側ではLockServiceと `submissionId` の重複確認を使います。

保存には `navigator.sendBeacon` を優先し、利用できない場合は非表示iframeへのGETで送信します。送信レスポンスをブラウザから読み取らないため、静的サイトからのクロスオリジン保存で結果本文のCORS許可を必要としません。

## 会場用統計画面

`stats.html` は、タイプ別と6つの軸要素別の集計だけを表示します。個別行、UUID、参加意向の個別値は表示しません。Apps Scriptの `?mode=stats&callback=...` JSONP APIを約5秒ごとに呼び出し、ページ全体を再読み込みせずに更新します。

統計ページのURLはサイト上にリンクを置かず、会場運営用として管理してください。URLを知っている人は集計値を閲覧できるため、厳密なアクセス制御が必要な場合はHWサーバー側のアクセス制御を追加してください。

## Google側の初期設定

1. 指定の運営GoogleアカウントでGoogle Apps Scriptの新規プロジェクトを作成します。
2. `backend/Code.gs` の内容を貼り付けます。
3. エディタで `setupStorage` を一度実行し、権限を承認します。非公開のGoogle Spreadsheetと `responses` シートが作成されます。
4. `ACCEPTING` がScript Propertiesで `true` になっていることを確認します。
5. Webアプリとしてデプロイします。実行ユーザーは自分、アクセスできるユーザーは「全員」にします。Spreadsheet自体は非公開のままにします。
6. 発行された `/exec` URLを `config.js` の `collectionUrl` と `statsUrl` に設定します。同じURLで保存と統計を受け付けます。
7. `index.html` から診断を完了し、参加意向を選択して、Spreadsheetに7列の1行が保存されることを確認します。`stats.html` で集計値も確認します。

既存のApps Scriptデプロイを更新する場合は、コードを差し替えた後に新しいバージョンを作成してデプロイしてください。古い4列構成の `responses` シートが残っている場合、初回実行時に `responses_legacy_...` へ変更し、新しい7列の `responses` シートを作成します。

## 静的ファイルの配置

Google側の設定後、`config.js` を含む静的ファイル一式をHWサーバーへ配置します。`index.html` と `stats.html` が同じ階層にあり、`assets/images/` の相対パスが保たれていれば動作します。GitHub Pagesを検証環境として使う場合も同じ構成で公開できます。

## ローカルテスト

Node.jsがある環境で次を実行します。

```sh
node --test tests/scoring.test.cjs tests/storage.test.cjs tests/collection.test.cjs
node --check script.js
node --check collection.js
```

ローカル画面をブラウザで確認する場合は、リポジトリのルートでHTTPサーバーを起動します。Apps ScriptのURLが空欄の状態でも、診断、ランダムな質問順、結果表示、参加意向の選択画面は確認できます。保存と統計は `config.js` に本番URLを設定した後に確認します。

## キャラクター画像について

キャラクター画像はAdobeの生成AIツールを使って制作したものです。サイト内にもその旨を表示しています。実際に使用したAdobe製品、生成モデル、生成時の設定、編集履歴、Content Credentialsの有無は、公開前に制作記録とAdobeの最新規約を照合してください。
