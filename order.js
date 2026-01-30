
// ビルド時に埋め込まれる設定値 ---
const GAS_ID = "m2";
const GAS_URL = "AKfycbz8zlq3jruXA401ajjxslfm9lELkMF-9WusRW5hMiUzRK5o7MU02YJGtErzPQqNXB29";

const GROUP_ID = "m2";
const UPLOAD_API_ENDPOINT = "https://order.dv-gsaroma.com/upload-api";
const GROUP_TOKEN = "37a007e6f56912cba97d868a41e3cb46";

// フォーム項目リスト(JSON文字列として埋め込まれ、JSでパースされる)
const FORM_FIELDS = JSON.parse('["マリン池袋北口駅前店"]');
const ENDPOINT = `https://script.google.com/macros/s/${GAS_URL}/exec`;

const CONFIG = {
    // GASから取得した値を格納する変数
    GROUP_NAME_FROM_SHEET: "",
    AUTH_PASSWORD: "",
    // アップロード設定
    UPLOAD_ENABLED: true,
    UPLOAD_API_ENDPOINT: UPLOAD_API_ENDPOINT,
    GROUP_TOKEN: GROUP_TOKEN,
    MAX_FILE_SIZE: 500 * 1024 * 1024  // 500MB
};

// メンバーリスト等を保持するデータオブジェクト
const MASTER_DATA = {
    members: []
};



let requestCount = 0;



// アプリケーション初期化関数
async function initApp() {

    // ローディング表示を追加
    const requestContainer = document.getElementById("requestContainer");

    // 要素が存在しない場合のエラーハンドリング
    if (!requestContainer) {
        console.error("requestContainer要素が見つかりません。HTMLに id='requestContainer' の要素があるか確認してください。");
        alert("ページの初期化に失敗しました。ページを再読み込みしてください。");
        return;
    }

    // パスワード入力プロンプト
    const password = prompt("認証パスワードを入力してください:");

    if (!password) {
        alert("パスワードが入力されませんでした。リロードして再試行してください。");
        requestContainer.innerHTML = '';
        return;
    }

    // 認証を待たずに、フォームを先行描画 ※メンバーリストは空の状態で描画されます
    requestContainer.innerHTML = '';
    setupEventHandlers();
    createRequestSet();

    try {
        // 認証リクエスト (GET)※裏側でGASへ問い合わせる
        // groupId と password をクエリパラメータとして送信
        const url = `${ENDPOINT}?groupId=${encodeURIComponent(GAS_ID)}&password=${encodeURIComponent(password)}`;

        // 読み込み中であることを示す(簡易的)
        document.body.style.cursor = "wait";

        const response = await fetch(url);

        // レスポンスのステータスチェック
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        document.body.style.cursor = "default";

        if (data.auth === true) {
            // 認証成功: データを保存
            console.log("認証成功:", data);

            // GASのF2セルの値
            CONFIG.GROUP_NAME_FROM_SHEET = data.groupName;

            // メンバーリストの更新
            MASTER_DATA.members = data.members || [];
            CONFIG.AUTH_PASSWORD = password;

            // 遅延反映：取得したメンバーリストを、既に表示されているフォームに適用する
            updateMemberDropdowns();

        } else {
            // 認証失敗
            // すでにフォームが見えてしまっているので、隠してリロード
            document.querySelector("main").style.display = "none";
            alert("パスワードが違います。");
            location.reload();
        }
    } catch (error) {
        console.error("通信エラー詳細:", error);
        alert(`サーバー通信エラーが発生しました。\n詳細: ${error.message}`);
        document.body.style.cursor = "default";
        requestContainer.innerHTML = '';
    }
}

function updateMemberDropdowns() {

    const selects = document.querySelectorAll('.member-select');

    selects.forEach(select => {

        // 現在の選択値を保持（もしユーザーが通信中に選んでいた場合のため）
        const currentValue = select.value;

        // 選択肢をクリア
        select.innerHTML = '';

        // デフォルトの空選択肢などを追加
        const defaultOption = document.createElement('option');
        defaultOption.text = "選択";
        defaultOption.value = "";
        select.appendChild(defaultOption);

        // 取得したメンバーを追加
        if (MASTER_DATA.members && MASTER_DATA.members.length > 0) {
            MASTER_DATA.members.forEach(member => {
                const option = document.createElement('option');
                option.text = member; // 名前
                option.value = member; // 値
                select.appendChild(option);
            });
        }

        // 固定の末尾オプション「未登録者」を追加
        const unknownOption = document.createElement('option');
        unknownOption.text = "未登録者";
        unknownOption.value = "未登録者";
        select.appendChild(unknownOption);

        // 値を復元（もしあれば）
        if(currentValue) {
            select.value = currentValue;
        }
    });
}

function createRequestSet() {
    requestCount++;

    let memberOptions = "";

    // メンバーリストが読み込まれていない場合は空文字列（updateMemberDropdowns関数で後から更新される）
    if (MASTER_DATA.members.length > 0) {
        // データがある状態（2行目の追加ボタンを押した時や、通信完了後）
        memberOptions = MASTER_DATA.members.map(member => {
            return `<option value="${member}">${member}</option>`;
        }).join('');
    }

    // FORM_FIELDSから店舗の選択肢を生成
    const placeOptions = FORM_FIELDS.map(place => {
        return `<option value="${place}">${place}</option>`;
    }).join('');

    // 前回の店舗選択値を取得
    let previousPlace = '';
    if (requestCount > 1) {
        const prevPlaceInput = document.querySelector(`input[name="place_${requestCount - 1}"]`);
        const prevPlaceSelect = document.querySelector(`select[name="place_${requestCount - 1}"]`);
        if (prevPlaceInput) {
            previousPlace = prevPlaceInput.value;
        } else if (prevPlaceSelect) {
            previousPlace = prevPlaceSelect.value;
        }
    }

    // 店舗が1つだけの場合の処理
    let placeSelectHTML;
    if (FORM_FIELDS.length === 1) {
        placeSelectHTML = `<input type="text" name="place_${requestCount}" value="${FORM_FIELDS[0]}" readonly class="readonly-input">`;
    } else if (requestCount > 1 && previousPlace) {
        // 2回目以降で前回の値がある場合
        placeSelectHTML = `
            <select name="place_${requestCount}" id="placeSelect_${requestCount}" required>
                <option value="">選択</option>
                <option value="${previousPlace}" selected>同上 (${previousPlace})</option>
                ${placeOptions}
            </select>`;
    } else {
        placeSelectHTML = `
            <select name="place_${requestCount}" id="placeSelect_${requestCount}" required>
                <option value="">選択</option>
                ${placeOptions}
            </select>`;
    }



    // 前回の依頼メンバー値を取得
    let previousMember = '';
    let previousMemberCustom = '';
    if (requestCount > 1) {
        const prevMemberSelect = document.querySelector(`select[name="member_${requestCount - 1}"]`);
        const prevMemberCustomInput = document.querySelector(`input[name="member_custom_${requestCount - 1}"]`);
        if (prevMemberSelect) {
            previousMember = prevMemberSelect.value;
        }
        if (prevMemberCustomInput) {
            previousMemberCustom = prevMemberCustomInput.value;
        }
    }

    // メンバー選択のHTML生成
    let memberSelectHTML = '';
    let memberCustomHTML = '';

    if (requestCount > 1 && (previousMember || previousMemberCustom)) {
        // 2回目以降で前回の値がある場合
        const displayText = previousMemberCustom || previousMember;

        // データが読み込まれている場合のみ「同上」オプションを追加
        let sameAsAboveOption = '';
        if (previousMember || previousMemberCustom) {
            sameAsAboveOption = `<option value="${previousMember || '未登録者'}" selected>同上 (${displayText})</option>`;
        }

        memberSelectHTML = `
            <select class="member-select" name="member_${requestCount}" data-index="${requestCount}">
                <option value="">選択</option>
                ${sameAsAboveOption}
                ${memberOptions}
                <option value="未登録者">未登録者</option>
            </select>`;
        memberCustomHTML = `<input class="member_custom" type="text" name="member_custom_${requestCount}" data-index="${requestCount}" placeholder="未登録者の場合はこちらに入力" value="${previousMemberCustom}">`;
    } else {
        // 初回 - データ読み込み中の場合も考慮
        const loadingOption = MASTER_DATA.members.length === 0 ? '' : '';
        memberSelectHTML = `
            <select class="member-select" name="member_${requestCount}" data-index="${requestCount}">
                <option value="">選択</option>
                ${memberOptions}
                <option value="未登録者">未登録者</option>
            </select>`;
        memberCustomHTML = `<input class="member_custom" type="text" name="member_custom_${requestCount}" data-index="${requestCount}" placeholder="未登録者の場合はこちらに入力">`;
    }

    // 削除ボタンのHTML生成（2つ目以降のみ表示）
    const deleteButtonHTML = requestCount > 1 ? `
        <button type="button" class="delete-request-btn" data-request-id="${requestCount}">
            <i class="fas fa-times"></i> 削除
        </button>
    ` : '';

    const div = document.createElement("div");
    div.className = "request-set";
    div.setAttribute('data-request-id', requestCount);

    // HTML生成
    div.innerHTML = `
        <div class="request-set-header">
            <h3 class="title2">フォームを入力してください</h3>
            ${deleteButtonHTML}
        </div>

        <label class="main-label mark">店舗選択</label>
        <div class="select-wrapper">
            ${placeSelectHTML}
        </div>

        <div class="form-group required">
            <label class="main-label mark">依頼メンバー選択</label>
            <div class="select-wrapper">
                ${memberSelectHTML}
            </div>
            ${memberCustomHTML}
        </div>

        <div class="form-group required">
            <label class="main-label mark">業務区分</label>
            <div class="select-wrapper">
                <select name="business_${requestCount}" class="business-select" data-index="${requestCount}" required>
                    <option value="">選択</option>
                    <option value="バナー">バナー</option>  <!-- グループ1用モーダル -->
                    <option value="LP">LP</option>         <!-- グループ2用モーダル -->
                    <option value="料金表">料金表</option>  <!-- グループ3用モーダル -->
                    <option value="WEB">WEB</option>            <!-- グループ4用モーダル -->
                    <option value="グラビア">グラビア</option>         <!-- グループ5用モーダル -->
                    <option value="動画">動画</option>           <!-- グループ4用モーダル -->
                    <option value="画像全般">画像全般</option>    <!-- グループ4用モーダル -->
                    <option value="POPポスター">POPポスター</option>         <!-- グループ6用モーダル -->
                    <option value="名刺">名刺</option>                           <!-- グループ7用モーダル -->
                    <option value="シール">シール</option>                        <!-- グループ7用モーダル -->
                    <option value="のぼり">のぼり</option>                        <!-- グループ7用モーダル -->
                    <option value="看板">看板</option>                       <!-- グループ6用モーダル -->
                    <option value="避難経路図">避難経路図</option><!-- グループ4用モーダル -->
                    <option value="組織図">組織図</option>                         <!-- グループ8用モーダル -->
                    <option value="その他">その他</option>           <!-- グループ4用モーダル -->
                </select>
            </div>
        </div>

        <div class="work-category-wrapper" id="workCategoryWrapper_${requestCount}" style="display: none;">
            <label class="main-label mark">作業区分 <i class="far fa-question-circle question-icon"></i></label>

            <!-- グループ1用モーダル（バナー） -->
            <div id="explanationModal_group1_${requestCount}" class="modal hidden explanation-modal" data-modal-group="group1">
                <div class="modal-content">
                    <span class="close-btn">&times;</span>
                    <p>
                    <strong>【バナー制作の入力方法】</strong><br>
                    <br>
                    パターン数(何種類の制作をするか)を<br>
                    入力し(最大9まで)、SETボタンを押す。<br>
                    <br>
                    各欄に制作タイトル、<br>
                    サイズ数（横 x 縦の画像サイズの必要数 ※最大20まで）、<br>
                    内容(詳細説明)を入力してください。
                    </p>
                </div>
            </div>

            <!-- グループ2用モーダル（LP） -->
            <div id="explanationModal_group2_${requestCount}" class="modal hidden explanation-modal" data-modal-group="group2">
                <div class="modal-content">
                    <span class="close-btn">&times;</span>
                    <p>
                    <strong>【LP制作の入力方法】</strong><br>
                    ページ・パターン数（LPを何ページ、または何種類の制作をするか）を<br>
                    入力し（最大9まで）、SETボタンを押す。<br>
                    <br>
                    各欄に制作タイトル、<br>
                    サイズ数（横 x 縦の画像サイズの必要数 ※最大20まで）、<br>
                    内容(詳細説明)を入力してください。
                    </p>
                </div>
            </div>

            <!-- グループ3用モーダル（料金表） -->
            <div id="explanationModal_group3_${requestCount}" class="modal hidden explanation-modal" data-modal-group="group3">
                <div class="modal-content">
                    <span class="close-btn">&times;</span>
                    <p>
                    <strong>【料金表制作の入力方法】</strong><br>
                    パターン数（何種類の料金表を制作するか）を<br>
                    入力し（最大9まで）、SETボタンを押す。<br>
                    <br>
                    各欄に制作タイトル、<br>
                    サイズ数（料金表サイズ必要数 ※最大20まで）、<br>
                    内容（詳細説明）を入力してください。
                    </p>
                </div>
            </div>

            <!-- グループ4用モーダル（WEB・動画・画像全般・避難経路図・その他） -->
            <div id="explanationModal_group4_${requestCount}" class="modal hidden explanation-modal" data-modal-group="group4">
                <div class="modal-content">
                    <span class="close-btn">&times;</span>
                    <p>
                    <strong>【作業区分の入力方法】</strong><br>
                    パターン数（何種類の依頼をするか）を<br>
                    入力し（最大9まで）、SETボタンを押す。<br>
                    <br>
                    各欄に制作タイトル、<br>
                    内容（詳細説明）を入力してください。
                    </p>
                </div>
            </div>

            <!-- グループ5用モーダル（グラビア） -->
            <div id="explanationModal_group5_${requestCount}" class="modal hidden explanation-modal" data-modal-group="group5">
                <div class="modal-content">
                    <span class="close-btn">&times;</span>
                    <p>
                    <strong>【グラビア制作の入力方法】</strong><br>
                    制作数を入力し（最大9まで）、<br>
                    SETボタンを押す。<br>
                    <br>
                    各欄に制作タイトル・名前、<br>
                    内容（詳細説明）を入力してください。
                    </p>
                </div>
            </div>

            <!-- グループ6用モーダル（POPポスター・看板） -->
            <div id="explanationModal_group6_${requestCount}" class="modal hidden explanation-modal" data-modal-group="group6">
                <div class="modal-content">
                    <span class="close-btn">&times;</span>
                    <p>
                    <strong>【印刷物制作の入力方法】</strong><br>
                    パターン数（何種類の印刷物を制作するか）を<br>
                    入力し（最大9まで）、SETボタンを押す。<br>
                    <br>
                    各欄に制作タイトル・印刷サイズ、枚数、<br>
                    内容（詳細説明）を入力してください。
                    </p>
                </div>
            </div>

            <!-- グループ7用モーダル（名刺・シール・のぼり） -->
            <div id="explanationModal_group7_${requestCount}" class="modal hidden explanation-modal" data-modal-group="group7">
                <div class="modal-content">
                    <span class="close-btn">&times;</span>
                    <p>
                    <strong>【作業区分の入力方法】</strong><br>
                    パターン数（何種類の制作をするか）を<br>
                    入力し（最大9まで）、SETボタンを押す。<br>
                    <br>
                    各欄に制作タイトル、枚数、<br>
                    内容（詳細説明）を入力してください。
                    </p>
                </div>
            </div>

            <!-- グループ8用モーダル（組織図） -->
            <div id="explanationModal_group8_${requestCount}" class="modal hidden explanation-modal" data-modal-group="group8">
                <div class="modal-content">
                    <span class="close-btn">&times;</span>
                    <p>
                    <strong>【組織図の入力方法】</strong><br>
                    人数を入力し（最大9まで）、<br>
                    SETボタンを押す。<br>
                    <br>
                    各欄に店舗名・名前、<br>
                    内容（詳細説明）を入力してください。
                    </p>
                </div>
            </div>

            <!-- グループ1: バナー -->
            <div class="category-box category-box-group1" data-business="バナー" style="display: none;">
                <div class="category-label-wrapper">
                    <div class="accordion-item" id="item-1_${requestCount}">
                        <div class="accordion-header">
                            <label class="category-label">
                                <input type="checkbox" class="enable-check" name="work_category_${requestCount}" value="新規作成">
                                <span class="item-title">新規作成</span>
                            </label>
                            <div class="input-group">
                                <span class="label-text">パターン数</span>
                                <input type="number" class="num-input pattern-count-input" min="1" max="9" placeholder="0">
                                <button type="button" class="set-btn">SET</button>
                            </div>
                        </div>
                        <div class="accordion-content">
                            <div class="pattern-rows-container"></div>
                        </div>
                    </div>

                    <div class="accordion-item" id="item-2_${requestCount}">
                        <div class="accordion-header">
                            <label class="category-label">
                                <input type="checkbox" class="enable-check" name="work_category_${requestCount}" value="修正">
                                <span class="item-title">修正</span>
                            </label>
                            <div class="input-group">
                                <span class="label-text">パターン数</span>
                                <input type="number" class="num-input pattern-count-input" min="1" max="9" placeholder="0">
                                <button type="button" class="set-btn">SET</button>
                            </div>
                        </div>
                        <div class="accordion-content">
                            <div class="pattern-rows-container"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- グループ2: LP -->
            <div class="category-box category-box-group2" data-business="LP" style="display: none;">
                <div class="category-label-wrapper">
                    <div class="accordion-item" id="item-1_${requestCount}" data-group="group2">
                        <div class="accordion-header">
                            <label class="category-label">
                                <input type="checkbox" class="enable-check" name="work_category_${requestCount}" value="新規作成">
                                <span class="item-title">新規作成</span>
                            </label>
                            <div class="input-group">
                                <span class="label-text">ページ・パターン数</span>
                                <input type="number" class="num-input pattern-count-input" min="1" max="9" placeholder="0">
                                <button type="button" class="set-btn">SET</button>
                            </div>
                        </div>
                        <div class="accordion-content">
                            <div class="pattern-rows-container"></div>
                        </div>
                    </div>

                    <div class="accordion-item" id="item-2_${requestCount}" data-group="group2">
                        <div class="accordion-header">
                            <label class="category-label">
                                <input type="checkbox" class="enable-check" name="work_category_${requestCount}" value="修正">
                                <span class="item-title">修正</span>
                            </label>
                            <div class="input-group">
                                <span class="label-text">ページ・パターン数</span>
                                <input type="number" class="num-input pattern-count-input" min="1" max="9" placeholder="0">
                                <button type="button" class="set-btn">SET</button>
                            </div>
                        </div>
                        <div class="accordion-content">
                            <div class="pattern-rows-container"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- グループ3: 料金表 -->
            <div class="category-box category-box-group3" data-business="料金表" style="display: none;">
                <div class="category-label-wrapper">
                    <div class="accordion-item" id="item-1_${requestCount}" data-group="group3">
                        <div class="accordion-header">
                            <label class="category-label">
                                <input type="checkbox" class="enable-check" name="work_category_${requestCount}" value="新規作成">
                                <span class="item-title">新規作成</span>
                            </label>
                            <div class="input-group">
                                <span class="label-text">パターン数</span>
                                <input type="number" class="num-input pattern-count-input" min="1" max="9" placeholder="0">
                                <button type="button" class="set-btn">SET</button>
                            </div>
                        </div>
                        <div class="accordion-content">
                            <div class="pattern-rows-container"></div>
                        </div>
                    </div>

                    <div class="accordion-item" id="item-2_${requestCount}" data-group="group2">
                        <div class="accordion-header">
                            <label class="category-label">
                                <input type="checkbox" class="enable-check" name="work_category_${requestCount}" value="修正">
                                <span class="item-title">修正</span>
                            </label>
                            <div class="input-group">
                                <span class="label-text">パターン数</span>
                                <input type="number" class="num-input pattern-count-input" min="1" max="9" placeholder="0">
                                <button type="button" class="set-btn">SET</button>
                            </div>
                        </div>
                        <div class="accordion-content">
                            <div class="pattern-rows-container"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- グループ4: WEB、動画、画像全般、避難経路図、その他 で共通 -->
            <div class="category-box category-box-group4" data-business="WEB,動画,画像全般,避難経路図,その他" style="display: none;">
                <div class="category-label-wrapper">
                    <div class="accordion-item" id="item-1_${requestCount}" data-group="group4">
                        <div class="accordion-header">
                            <label class="category-label">
                                <input type="checkbox" class="enable-check" name="work_category_${requestCount}" value="新規作成">
                                <span class="item-title">新規作成</span>
                            </label>
                            <div class="input-group">
                                <span class="label-text">パターン数</span>
                                <input type="number" class="num-input pattern-count-input" min="1" max="9" placeholder="0">
                                <button type="button" class="set-btn">SET</button>
                            </div>
                        </div>
                        <div class="accordion-content">
                            <div class="pattern-rows-container"></div>
                        </div>
                    </div>

                    <div class="accordion-item" id="item-2_${requestCount}" data-group="group2">
                        <div class="accordion-header">
                            <label class="category-label">
                                <input type="checkbox" class="enable-check" name="work_category_${requestCount}" value="修正">
                                <span class="item-title">修正</span>
                            </label>
                            <div class="input-group">
                                <span class="label-text">パターン数</span>
                                <input type="number" class="num-input pattern-count-input" min="1" max="9" placeholder="0">
                                <button type="button" class="set-btn">SET</button>
                            </div>
                        </div>
                        <div class="accordion-content">
                            <div class="pattern-rows-container"></div>
                        </div>
                    </div>

                    <div class="accordion-item" id="item-3_${requestCount}">
                        <div class="accordion-header">
                            <label class="category-label">
                                <input type="checkbox" class="enable-check" name="work_category_${requestCount}" value="その他">
                                <span class="item-title">その他</span>
                            </label>
                            <div class="input-group">
                                <span class="label-text">パターン数</span>
                                <input type="number" class="num-input pattern-count-input" min="1" max="9" placeholder="0">
                                <button type="button" class="set-btn">SET</button>
                            </div>
                        </div>
                        <div class="accordion-content">
                            <div class="pattern-rows-container"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- グループ5: グラビア -->
            <div class="category-box category-box-group5" data-business="グラビア" style="display: none;">
                <div class="category-label-wrapper">
                    <div class="accordion-item" id="item-1_${requestCount}">
                        <div class="accordion-header">
                            <label class="category-label">
                                <input type="checkbox" class="enable-check" name="work_category_${requestCount}" value="新規作成">
                                <span class="item-title">新規作成</span>
                            </label>
                            <div class="input-group">
                                <span class="label-text">制作数</span>
                                <input type="number" class="num-input pattern-count-input" min="1" max="9" placeholder="0">
                                <button type="button" class="set-btn">SET</button>
                            </div>
                        </div>
                        <div class="accordion-content">
                            <div class="pattern-rows-container"></div>
                        </div>
                    </div>

                    <div class="accordion-item" id="item-2_${requestCount}">
                        <div class="accordion-header">
                            <label class="category-label">
                                <input type="checkbox" class="enable-check" name="work_category_${requestCount}" value="修正">
                                <span class="item-title">修正</span>
                            </label>
                            <div class="input-group">
                                <span class="label-text">制作数</span>
                                <input type="number" class="num-input pattern-count-input" min="1" max="9" placeholder="0">
                                <button type="button" class="set-btn">SET</button>
                            </div>
                        </div>
                        <div class="accordion-content">
                            <div class="pattern-rows-container"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- グループ6: POPポスター・看板 で共通 -->
            <div class="category-box category-box-group6" data-business="POPポスター,看板" style="display: none;">
                <div class="category-label-wrapper">
                    <div class="accordion-item" id="item-1_${requestCount}">
                        <div class="accordion-header">
                            <label class="category-label">
                                <input type="checkbox" class="enable-check" name="work_category_${requestCount}" value="新規作成">
                                <span class="item-title">新規作成</span>
                            </label>
                            <div class="input-group">
                                <span class="label-text">パターン数</span>
                                <input type="number" class="num-input pattern-count-input" min="1" max="9" placeholder="0">
                                <button type="button" class="set-btn">SET</button>
                            </div>
                        </div>
                        <div class="accordion-content">
                            <div class="pattern-rows-container"></div>
                        </div>
                    </div>

                    <div class="accordion-item" id="item-2_${requestCount}">
                        <div class="accordion-header">
                            <label class="category-label">
                                <input type="checkbox" class="enable-check" name="work_category_${requestCount}" value="修正">
                                <span class="item-title">修正</span>
                            </label>
                            <div class="input-group">
                                <span class="label-text">パターン数</span>
                                <input type="number" class="num-input pattern-count-input" min="1" max="9" placeholder="0">
                                <button type="button" class="set-btn">SET</button>
                            </div>
                        </div>
                        <div class="accordion-content">
                            <div class="pattern-rows-container"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- グループ7: 名刺・シール・のぼり -->
            <div class="category-box category-box-group7" data-business="名刺,シール,のぼり" style="display: none;">
                <div class="category-label-wrapper">
                    <div class="accordion-item" id="item-1_${requestCount}">
                        <div class="accordion-header">
                            <label class="category-label">
                                <input type="checkbox" class="enable-check" name="work_category_${requestCount}" value="新規作成">
                                <span class="item-title">新規作成</span>
                            </label>
                            <div class="input-group">
                                <span class="label-text">枚数</span>
                                <input type="number" class="num-input pattern-count-input" min="1" max="9" placeholder="0">
                                <button type="button" class="set-btn">SET</button>
                            </div>
                        </div>
                        <div class="accordion-content">
                            <div class="pattern-rows-container"></div>
                        </div>
                    </div>

                    <div class="accordion-item" id="item-2_${requestCount}">
                        <div class="accordion-header">
                            <label class="category-label">
                                <input type="checkbox" class="enable-check" name="work_category_${requestCount}" value="修正">
                                <span class="item-title">修正</span>
                            </label>
                            <div class="input-group">
                                <span class="label-text">枚数</span>
                                <input type="number" class="num-input pattern-count-input" min="1" max="9" placeholder="0">
                                <button type="button" class="set-btn">SET</button>
                            </div>
                        </div>
                        <div class="accordion-content">
                            <div class="pattern-rows-container"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- グループ8: 組織図 -->
            <div class="category-box category-box-group8" data-business="組織図" style="display: none;">
                <div class="category-label-wrapper">
                    <div class="accordion-item" id="item-1_${requestCount}">
                        <div class="accordion-header">
                            <label class="category-label">
                                <input type="checkbox" class="enable-check" name="work_category_${requestCount}" value="新規">
                                <span class="item-title">新規</span>
                            </label>
                            <div class="input-group">
                                <span class="label-text">人数</span>
                                <input type="number" class="num-input pattern-count-input" min="1" max="9" placeholder="0">
                                <button type="button" class="set-btn">SET</button>
                            </div>
                        </div>
                        <div class="accordion-content">
                            <div class="pattern-rows-container"></div>
                        </div>
                    </div>

                    <div class="accordion-item" id="item-2_${requestCount}">
                        <div class="accordion-header">
                            <label class="category-label">
                                <input type="checkbox" class="enable-check" name="work_category_${requestCount}" value="修正">
                                <span class="item-title">修正</span>
                            </label>
                            <div class="input-group">
                                <span class="label-text">人数</span>
                                <input type="number" class="num-input pattern-count-input" min="1" max="9" placeholder="0">
                                <button type="button" class="set-btn">SET</button>
                            </div>
                        </div>
                        <div class="accordion-content">
                            <div class="pattern-rows-container"></div>
                        </div>
                    </div>

                    <div class="accordion-item" id="item-3_${requestCount}">
                        <div class="accordion-header">
                            <label class="category-label">
                                <input type="checkbox" class="enable-check" name="work_category_${requestCount}" value="削除">
                                <span class="item-title">削除</span>
                            </label>
                            <div class="input-group">
                                <span class="label-text">人数</span>
                                <input type="number" class="num-input pattern-count-input" min="1" max="9" placeholder="0">
                                <button type="button" class="set-btn">SET</button>
                            </div>
                        </div>
                        <div class="accordion-content">
                            <div class="pattern-rows-container"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="size-buttons" id="sizeButtonsWrapper_${requestCount}" style="display: none;">
            <button type="button" class="size-toggle-btn"
                id="bannerSizeBtn_${requestCount}"
                data-target="banner-size-block_${requestCount}"
                data-original-text="バナーサイズ一覧"
                style="display: none;">バナーサイズ一覧</button>
            <button type="button" class="size-toggle-btn"
                id="annotationBtn_${requestCount}"
                data-target="annotation-block_${requestCount}"
                data-original-text="注釈一覧"
                style="display: none;">注釈一覧</button>

            <button type="button" class="size-toggle-btn"
                id="lpSizeBtn_${requestCount}"
                data-target="lp-size-block_${requestCount}"
                data-original-text="LPサイズ一覧"
                style="display: none;">LPサイズ一覧</button>
            <button type="button" class="size-toggle-btn"
                id="lpAnnotationBtn_${requestCount}"
                data-target="lp-annotation-block_${requestCount}"
                data-original-text="LP注釈"
                style="display: none;">LP注釈</button>

            <button type="button" class="size-toggle-btn"
                id="priceSizeBtn_${requestCount}"
                data-target="price-size-block_${requestCount}"
                data-original-text="料金表サイズ一覧"
                style="display: none;">料金表サイズ一覧</button>
            <button type="button" class="size-toggle-btn"
                id="priceAnnotationBtn_${requestCount}"
                data-target="price-annotation-block_${requestCount}"
                data-original-text="料金表注釈"
                style="display: none;">料金表注釈</button>

            <button type="button" class="size-toggle-btn"
                id="gravureSizeBtn_${requestCount}"
                data-target="gravure-size-block_${requestCount}"
                data-original-text="グラビアオーダー"
                style="display: none;">グラビアオーダー</button>

            <button type="button" class="size-toggle-btn"
                id="printSizeBtn_${requestCount}"
                data-target="print-size-block_${requestCount}"
                data-original-text="印刷サイズ一覧"
                style="display: none;">印刷サイズ一覧</button>
            <button type="button" class="size-toggle-btn"
                id="printAnnotationBtn_${requestCount}"
                data-target="print-annotation-block_${requestCount}"
                data-original-text="印刷注釈"
                style="display: none;">印刷注釈</button>
        </div>

        <div class="main-block hidden" id="banner-size-block_${requestCount}">
            <p class="size-help-text">クリックで内容欄に追加されます（最後にフォーカスした内容欄が対象）</p>
            <div class="button-group" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
                <button type="button" class="size-insert-btn" data-size="1920x1080">1920x1080</button>
                <button type="button" class="size-insert-btn" data-size="640x640">640x640</button>
                <button type="button" class="size-insert-btn" data-size="976x211">976x211</button>
                <button type="button" class="size-insert-btn" data-size="750x470">750x470</button>
                <button type="button" class="size-insert-btn" data-size="700x300">700x300</button>
                <button type="button" class="size-insert-btn" data-size="580x250">580x250</button>
                <button type="button" class="size-insert-btn" data-size="1500x500">1500x500</button>
            </div>
        </div>

        <div class="main-block hidden" id="annotation-block_${requestCount}">
            <p class="size-help-text">クリックで内容欄に追加されます（最後にフォーカスした内容欄が対象）</p>
            <div class="button-group" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
                <button type="button" class="annotation-insert-btn" data-annotation="(GIF画像)">(GIF画像)</button>
                <button type="button" class="annotation-insert-btn" data-annotation="(1MB以下)">(1MB以下)</button>
                <button type="button" class="annotation-insert-btn" data-annotation="(500KB以下)">(500KB以下)</button>
                <button type="button" class="annotation-insert-btn" data-annotation="上記と同じ">上記と同じ</button>
            </div>
        </div>



        <div class="main-block hidden" id="lp-size-block_${requestCount}">
            <p class="size-help-text">クリックで内容欄に追加されます（最後にフォーカスした内容欄が対象）</p>
            <div class="button-group" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
                <button type="button" class="lp-insert-btn" data-size="w640">w640</button>
                <button type="button" class="lp-insert-btn" data-size="w700">w700</button>
            </div>
        </div>

        <div class="main-block hidden" id="lp-annotation-block_${requestCount}">
            <p class="size-help-text">クリックで内容欄に追加されます（最後にフォーカスした内容欄が対象）</p>
            <div class="button-group" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
                <button type="button" class="lp-annotation-insert-btn" data-annotation="(1MB以下)">(1MB以下)</button>
                <button type="button" class="lp-annotation-insert-btn" data-annotation="(500KB以下)">(500KB以下)</button>
                <button type="button" class="lp-annotation-insert-btn" data-annotation="上記と同じ">上記と同じ</button>
            </div>
        </div>



        <div class="main-block hidden" id="gravure-size-block_${requestCount}">
            <p class="size-help-text">クリックで内容欄に追加されます（最後にフォーカスした内容欄が対象）</p>
            <div class="button-group" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
                <button type="button" class="gravure-insert-btn" data-size="w990~">w990~</button>
                <button type="button" class="gravure-insert-btn" data-size="640x260">640x260</button>
                <button type="button" class="gravure-insert-btn" data-size="SET:w990~ ,640x260">SET:w990~ ,640x260</button>
                <button type="button" class="gravure-insert-btn" data-size="上記と同じ">上記と同じ</button>
            </div>
        </div>



        <div class="main-block hidden" id="price-size-block_${requestCount}">
            <p class="size-help-text">クリックで内容欄に追加されます（最後にフォーカスした内容欄が対象）</p>
            <div class="button-group" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
                <button type="button" class="price-insert-btn" data-size="A4(ﾗﾐﾈｰﾄ)">A4(ﾗﾐﾈｰﾄ)</button>
                <button type="button" class="price-insert-btn" data-size="A3(ﾗﾐﾈｰﾄ)">A3(ﾗﾐﾈｰﾄ)</button>
                <button type="button" class="price-insert-btn" data-size="1920x1080">1920x1080</button>
                <button type="button" class="price-insert-btn" data-size="640x640">640x640</button>
            </div>
        </div>

        <div class="main-block hidden" id="price-annotation-block_${requestCount}">
            <p class="size-help-text">クリックで内容欄に追加されます（最後にフォーカスした内容欄が対象）</p>
            <div class="button-group" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
                <button type="button" class="price-annotation-insert-btn" data-annotation="(1MB以下)">(1MB以下)</button>
                <button type="button" class="price-annotation-insert-btn" data-annotation="(500KB以下)">(500KB以下)</button>
                <button type="button" class="price-annotation-insert-btn" data-annotation="(英語版)">(英語版)</button>
                <button type="button" class="price-annotation-insert-btn" data-annotation="(中国語版)">(中国語版)</button>
                <button type="button" class="price-annotation-insert-btn" data-annotation="上記と同じ">上記と同じ</button>
            </div>
        </div>



        <div class="main-block hidden" id="print-size-block_${requestCount}">
            <p class="size-help-text">クリックで内容欄に追加されます（最後にフォーカスした内容欄が対象）</p>
            <div class="button-group" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
                <!-- 普通紙 -->
                <button type="button" class="print-size-insert-btn" data-print-size="普通紙(ﾗﾐﾈｰﾄ)A1">普通紙(ﾗﾐﾈｰﾄ)A1</button>
                <button type="button" class="print-size-insert-btn" data-print-size="普通紙(ﾗﾐﾈｰﾄ)A2">普通紙(ﾗﾐﾈｰﾄ)A2</button>
                <button type="button" class="print-size-insert-btn" data-print-size="普通紙(ﾗﾐﾈｰﾄ)A3">普通紙(ﾗﾐﾈｰﾄ)A3</button>
                <button type="button" class="print-size-insert-btn" data-print-size="普通紙(ﾗﾐﾈｰﾄ)A4">普通紙(ﾗﾐﾈｰﾄ)A4</button>

                <!-- 写真紙 -->
                <button type="button" class="print-size-insert-btn" data-print-size="写真紙(ﾗﾐﾈｰﾄ)A1">写真紙(ﾗﾐﾈｰﾄ)A1</button>
                <button type="button" class="print-size-insert-btn" data-print-size="写真紙(ﾗﾐﾈｰﾄ)A2">写真紙(ﾗﾐﾈｰﾄ)A2</button>
                <!-- 内照紙 -->
                <button type="button" class="print-size-insert-btn" data-print-size="内照紙(ﾗﾐﾈｰﾄ)A1">内照紙(ﾗﾐﾈｰﾄ)A1</button>
                <button type="button" class="print-size-insert-btn" data-print-size="内照紙(ﾗﾐﾈｰﾄ)A2">内照紙(ﾗﾐﾈｰﾄ)A2</button>

                <button type="button" class="print-size-insert-btn" data-print-size="ﾗﾐﾈｰﾄ無し">ﾗﾐﾈｰﾄ無し</button>
                <button type="button" class="print-size-insert-btn" data-print-size="その他サイズ">その他サイズ</button>
                <button type="button" class="print-size-insert-btn" data-print-size="上記と同じ">上記と同じ</button>
            </div>
        </div>

        <label class="main-label">ZIP</label>
        <div class="file-upload-area" id="fileUploadArea_${requestCount}">
            <div class="file-dropzone" id="fileDropzone_${requestCount}">
                <i class="fas fa-cloud-upload-alt"></i>
                <p>ZIPファイルをドラッグ＆ドロップ<br>または</p>
                <button type="button" class="file-select-btn" id="fileSelectBtn_${requestCount}">ファイルを選択</button>
                <input type="file" id="zipFileInput_${requestCount}" accept=".zip" style="display: none;">
                <p class="file-info">ファイル形式: ZIP / 最大容量: 500MB</p>
            </div>
            <div class="file-list" id="fileList_${requestCount}"></div>
        </div>
    `;

    document.getElementById("requestContainer").appendChild(div);

    // ファイルアップロード機能の初期化
    setupFileUpload(requestCount);

    // 業務区分の変更イベント
    const businessSelect = div.querySelector(`select[name="business_${requestCount}"]`);
    const workCategoryWrapper = div.querySelector(`#workCategoryWrapper_${requestCount}`);
    const allCategoryBoxes = div.querySelectorAll('.category-box');

    if (businessSelect && workCategoryWrapper) {
        businessSelect.addEventListener('change', function() {
            const selectedBusiness = this.value;
            const sizeButtonsWrapper = div.querySelector(`#sizeButtonsWrapper_${requestCount}`);

            const bannerSizeBtn = div.querySelector(`#bannerSizeBtn_${requestCount}`);
            const annotationBtn = div.querySelector(`#annotationBtn_${requestCount}`);
            const printSizeBtn = div.querySelector(`#printSizeBtn_${requestCount}`);
            const lpSizeBtn = div.querySelector(`#lpSizeBtn_${requestCount}`);
            const lpAnnotationBtn = div.querySelector(`#lpAnnotationBtn_${requestCount}`);
            const gravureSizeBtn = div.querySelector(`#gravureSizeBtn_${requestCount}`);
            const priceSizeBtn = div.querySelector(`#priceSizeBtn_${requestCount}`);
            const priceAnnotationBtn = div.querySelector(`#priceAnnotationBtn_${requestCount}`);

            // 全てのカテゴリボックスを非表示
            allCategoryBoxes.forEach(box => {
                box.style.display = 'none';
            });

            // 全てのボタンを配列化して一旦非表示にする関数
            const allBtns = [
                bannerSizeBtn, annotationBtn, printSizeBtn,
                lpSizeBtn, lpAnnotationBtn, gravureSizeBtn,
                priceSizeBtn, priceAnnotationBtn
            ];
            const hideAllButtons = () => {
                allBtns.forEach(btn => {
                    if (btn) btn.style.display = 'none';
                });
            };

            if (selectedBusiness) {
                // 業務カテゴリ表示
                workCategoryWrapper.style.display = 'block';

                // 選択された業務区分に対応するカテゴリボックスを表示
                let currentGroup = '';

                if (selectedBusiness === 'バナー') {
                    const targetBox = div.querySelector('.category-box-group1');
                    if (targetBox) targetBox.style.display = 'block';
                    currentGroup = 'group1';

                    if (sizeButtonsWrapper) {
                        sizeButtonsWrapper.style.display = 'block';
                        hideAllButtons();
                        if (bannerSizeBtn) bannerSizeBtn.style.display = 'inline-block';
                        if (annotationBtn) annotationBtn.style.display = 'inline-block';
                    }

                } else if (selectedBusiness === 'LP') {
                    const targetBox = div.querySelector('.category-box-group2');
                    if (targetBox) targetBox.style.display = 'block';
                    currentGroup = 'group2';

                    if (sizeButtonsWrapper) {
                        sizeButtonsWrapper.style.display = 'block';
                        hideAllButtons();
                        if (lpSizeBtn) lpSizeBtn.style.display = 'inline-block';
                        if (lpAnnotationBtn) lpAnnotationBtn.style.display = 'inline-block';
                    }

                } else if (selectedBusiness === '料金表') {
                    const targetBox = div.querySelector('.category-box-group3');
                    if (targetBox) targetBox.style.display = 'block';
                    currentGroup = 'group3';

                    if (sizeButtonsWrapper) {
                        sizeButtonsWrapper.style.display = 'block';
                        hideAllButtons();
                        if (priceSizeBtn) priceSizeBtn.style.display = 'inline-block';
                        if (priceAnnotationBtn) priceAnnotationBtn.style.display = 'inline-block';
                    }

                } else if (['WEB', '動画', '画像全般', '避難経路図', 'その他'].includes(selectedBusiness)) {
                    const targetBox = div.querySelector('.category-box-group4');
                    if (targetBox) targetBox.style.display = 'block';
                    currentGroup = 'group4';

                    if (sizeButtonsWrapper) {
                        sizeButtonsWrapper.style.display = 'block';
                        hideAllButtons();
                    }

                } else if (selectedBusiness === 'グラビア') {
                    const targetBox = div.querySelector('.category-box-group5');
                    if (targetBox) targetBox.style.display = 'block';
                    currentGroup = 'group5';

                    if (sizeButtonsWrapper) {
                        sizeButtonsWrapper.style.display = 'block';
                        hideAllButtons();
                        if (gravureSizeBtn) gravureSizeBtn.style.display = 'inline-block';
                    }

                } else if (['POPポスター', '看板'].includes(selectedBusiness)) {
                    const targetBox = div.querySelector('.category-box-group6');
                    if (targetBox) targetBox.style.display = 'block';
                    currentGroup = 'group6';

                    if (sizeButtonsWrapper) {
                        sizeButtonsWrapper.style.display = 'block';
                        hideAllButtons();
                        if (printSizeBtn) printSizeBtn.style.display = 'inline-block';
                    }

                } else if (['名刺', 'シール', 'のぼり'].includes(selectedBusiness)) {
                    const targetBox = div.querySelector('.category-box-group7');
                    if (targetBox) targetBox.style.display = 'block';
                    currentGroup = 'group7';

                    if (sizeButtonsWrapper) {
                        sizeButtonsWrapper.style.display = 'block';
                        hideAllButtons();
                    }

                } else if (selectedBusiness === '組織図') {
                    const targetBox = div.querySelector('.category-box-group8');
                    if (targetBox) targetBox.style.display = 'block';
                    currentGroup = 'group8';

                    if (sizeButtonsWrapper) {
                        sizeButtonsWrapper.style.display = 'block';
                        hideAllButtons();
                    }
                }

                // モーダル表示用にグループ情報を保存
                workCategoryWrapper.setAttribute('data-current-group', currentGroup);

            } else {
                // 選択なしの場合
                workCategoryWrapper.style.display = 'none';
                workCategoryWrapper.removeAttribute('data-current-group');
                if (sizeButtonsWrapper) {
                    sizeButtonsWrapper.style.display = 'none';
                    hideAllButtons();
                }
            }
        });
    }


    // 依頼メンバーのバリデーション処理
    const memberSelect = div.querySelector(`select[name="member_${requestCount}"]`);
    const memberCustomInput = div.querySelector(`input[name="member_custom_${requestCount}"]`);

    if (memberSelect && memberCustomInput) {
        // セレクトボックス変更時の処理
        memberSelect.addEventListener('change', function() {
            if (this.value === '未登録者') {
                // 未登録者を選択した場合、カスタム入力を必須にする
                memberCustomInput.setAttribute('required', 'required');
                memberCustomInput.style.borderColor = '#ff6b6b';
            } else if (this.value !== '') {
                // 登録メンバーを選択した場合、カスタム入力の必須を解除
                memberCustomInput.removeAttribute('required');
                memberCustomInput.style.borderColor = '';
                memberCustomInput.value = ''; // 入力値をクリア
            } else {
                // 未選択の場合
                memberCustomInput.removeAttribute('required');
                memberCustomInput.style.borderColor = '';
            }
        });

        // カスタム入力フィールドの入力時の処理
        memberCustomInput.addEventListener('input', function() {
            if (this.value.trim() !== '') {
                // カスタム入力に値がある場合、セレクトの必須を解除
                memberSelect.removeAttribute('required');
            } else {
                // カスタム入力が空の場合、セレクトを必須に戻す
                memberSelect.setAttribute('required', 'required');
            }
        });
    }

    // モーダル制御 - グループに応じたモーダルを表示
    const questionIcon = div.querySelector('.question-icon');
    const allModals = div.querySelectorAll('.explanation-modal');

    if (questionIcon) {
        questionIcon.addEventListener('click', (e) => {
            e.preventDefault();

            // 現在選択されているグループを取得
            const currentGroup = workCategoryWrapper.getAttribute('data-current-group');

            if (currentGroup) {
                // 該当グループのモーダルを探して表示
                const targetModal = div.querySelector(`#explanationModal_${currentGroup}_${requestCount}`);
                if (targetModal) {
                    targetModal.classList.remove('hidden');
                }
            }
        });
    }

    // すべてのモーダルに閉じるボタンのイベントを設定
    allModals.forEach(modal => {
        const closeBtn = modal.querySelector('.close-btn');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        }

        // モーダル外クリックで閉じる処理
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    });


    // SETボタンとアコーディオンのイベント設定(動的に追加された要素用)
    div.querySelectorAll('.accordion-item').forEach(item => {
        const setBtn = item.querySelector('.set-btn');
        const patternCountInput = item.querySelector('.pattern-count-input');
        const contentArea = item.querySelector('.accordion-content');
        const patternRowsContainer = item.querySelector('.pattern-rows-container');

        // SETボタンクリック時の処理
        setBtn.addEventListener('click', () => {
            let count = parseInt(patternCountInput.value, 10);

            // バリデーション:1〜9の間
            if (isNaN(count) || count <= 0) return;
            if (count > 9) {
                alert('最大9までしか入力できません');
                patternCountInput.value = 9;
                count = 9;
            }

            // 既存の行をクリアして再生成
            patternRowsContainer.innerHTML = '';

            // 作業区分の値を取得
            const categoryValue = item.querySelector('.enable-check').value;

            for (let i = 1; i <= count; i++) {
                // パターンごとのアコーディオンブロックを作成
                const patternAccordion = document.createElement('div');
                patternAccordion.className = 'pattern-accordion';
                patternAccordion.setAttribute('data-pattern-index', i);

                // アコーディオンヘッダー
                const accordionToggle = document.createElement('div');
                accordionToggle.className = 'pattern-accordion-toggle';
                accordionToggle.innerHTML = `
                    <span class="pattern-number">パターン${i}</span>
                    <i class="fas fa-chevron-circle-down accordion-icon"></i>
                `;

                // パターンブロック（アコーディオンの中身）
                const patternBlock = document.createElement('div');
                patternBlock.className = 'pattern-block';
                patternBlock.style.display = 'block'; // 初期状態は開いている

                // パターン名入力とサイズ数入力の行
                const rowDiv = document.createElement('div');
                rowDiv.className = 'generated-row';

                // 業務区分に応じたテキスト 現在選択されている業務区分を取得
                const businessSelect = div.querySelector(`.business-select[data-index="${requestCount}"]`);
                const currentBusiness = businessSelect ? businessSelect.value : '';

                let placeholderText = `パターン${i}タイトル`;
                let labelText = 'サイズ数';

                if (['WEB', '動画', '画像全般', '避難経路図', 'その他'].includes(currentBusiness)) {
                    placeholderText = `パターン${i}タイトル`;
                    labelText = 'サイズ数'; // または必要に応じて非表示
                } else if (currentBusiness === 'グラビア') {
                    placeholderText = `パターン${i}タイトル・名前`;
                    labelText = '制作数'; // HTML側の初期値に合わせて適宜変更
                } else if (['POPポスター', '看板'].includes(currentBusiness)) {
                    placeholderText = `パターン${i}タイトル・印刷サイズ`;
                    labelText = '枚数';
                } else if (['名刺', 'シール', 'のぼり'].includes(currentBusiness)) {
                    placeholderText = `パターン${i}タイトル`;
                    labelText = '枚数';
                } else if (currentBusiness === '組織図') {
                    placeholderText = `パターン${i}店舗名・名前`;
                    labelText = '人数'; // HTML側の初期値に合わせて適宜変更
                }
                // バナー, LP, 料金表 はデフォルト (タイトル / サイズ数)



                const patternInput = document.createElement('input');
                patternInput.type = 'text';
                patternInput.className = 'pattern-text-input';
                patternInput.name = `pattern_text_${requestCount}_${categoryValue}_${i}`;
                // 設定した変数を適用
                patternInput.placeholder = placeholderText;

                // 「サイズ数/枚数」ラベル
                const sizeLabel = document.createElement('span');
                // 設定した変数を適用
                sizeLabel.textContent = labelText;
                sizeLabel.className = 'label-text';

                // サイズ数入力 (数字2桁)
                const sizeInput = document.createElement('input');
                sizeInput.type = 'number';
                sizeInput.className = 'num-input size-count-input';
                sizeInput.name = `size_count_${requestCount}_${categoryValue}_${i}`;
                sizeInput.min = '0';
                sizeInput.max = '20';
                sizeInput.placeholder = '0';

                // 要素を追加
                rowDiv.appendChild(patternInput);
                rowDiv.appendChild(sizeLabel);
                rowDiv.appendChild(sizeInput);

                patternBlock.appendChild(rowDiv);

                // 内容のtextarea
                const detailsDiv = document.createElement('div');
                detailsDiv.className = 'details-area';

                const detailsLabelDiv = document.createElement('div');
                detailsLabelDiv.className = 'details-label-wrapper';

                const detailsLabel = document.createElement('label');
                detailsLabel.className = 'main-label mark';
                detailsLabel.textContent = `内容${i}`;

                detailsLabelDiv.appendChild(detailsLabel);

                const detailsTextarea = document.createElement('textarea');
                detailsTextarea.className = 'sync-target';
                detailsTextarea.name = `details_${requestCount}_${categoryValue}_${i}`;

                detailsDiv.appendChild(detailsLabelDiv);
                detailsDiv.appendChild(detailsTextarea);

                patternBlock.appendChild(detailsDiv);

                // 備考のtextarea
                const noteDiv = document.createElement('div');
                noteDiv.className = 'note-area';

                const noteLabel = document.createElement('label');
                noteLabel.className = 'main-label';
                noteLabel.textContent = `備考${i}`;

                const noteTextarea = document.createElement('textarea');
                noteTextarea.className = 'note-box';
                noteTextarea.name = `note_${requestCount}_${categoryValue}_${i}`;

                noteDiv.appendChild(noteLabel);
                noteDiv.appendChild(noteTextarea);

                patternBlock.appendChild(noteDiv);

                // アコーディオンに要素を追加
                patternAccordion.appendChild(accordionToggle);
                patternAccordion.appendChild(patternBlock);
                patternRowsContainer.appendChild(patternAccordion);

                // アコーディオンのトグル機能
                accordionToggle.addEventListener('click', function() {
                    const isOpen = patternBlock.style.display === 'block';
                    patternBlock.style.display = isOpen ? 'none' : 'block';

                    const icon = this.querySelector('.accordion-icon');
                    if (isOpen) {
                        icon.classList.remove('fa-chevron-circle-down');
                        icon.classList.add('fa-chevron-circle-right');
                    } else {
                        icon.classList.remove('fa-chevron-circle-right');
                        icon.classList.add('fa-chevron-circle-down');
                    }
                });

                // 同期処理のイベントリスナーを追加
                const updateDetails = () => {
                    const pName = patternInput.value.trim() !== '' ? patternInput.value : patternInput.placeholder;
                    const sCount = sizeInput.value;

                    if (sCount) {
                        detailsTextarea.value = `${pName}:${sCount}サイズ`;
                    } else {
                        detailsTextarea.value = '';
                    }
                };

                patternInput.addEventListener('input', updateDetails);
                sizeInput.addEventListener('input', updateDetails);
            }

            // エリアを表示する
            contentArea.classList.add('active');
        });

        // 入力制限(数字2桁、最大20)
        item.addEventListener('input', (e) => {
            if (e.target.classList.contains('num-input')) {
                let val = parseInt(e.target.value, 10);
                if (val > 20) e.target.value = 20;
                // 文字数制限(2桁)
                if (e.target.value.length > 2) {
                    e.target.value = e.target.value.slice(0, 2);
                }
            }
        });
    });

    // サイズボタンのトグル処理
    const sizeButtons = div.querySelectorAll('.size-toggle-btn');

    // バナーサイズ挿入ボタンのイベント
    const sizeInsertButtons = div.querySelectorAll('.size-insert-btn');
    sizeInsertButtons.forEach(button => {
        button.addEventListener('click', function() {
            const sizeValue = this.dataset.size;

            if (!lastFocusedDetailsTextarea) {
                alert('内容欄をクリックしてから、サイズを選択してください');
                return;
            }

            // 現在の値に追加
            const currentValue = lastFocusedDetailsTextarea.value;
            if (currentValue && !currentValue.endsWith(',')) {
                lastFocusedDetailsTextarea.value = currentValue + ',' + sizeValue + ',';
            } else if (currentValue) {
                lastFocusedDetailsTextarea.value = currentValue + sizeValue + ',';
            } else {
                lastFocusedDetailsTextarea.value = sizeValue + ',';
            }

            // フォーカスを戻す
            lastFocusedDetailsTextarea.focus();
        });
    });

    // LPサイズ挿入ボタンのイベント
    const lpInsertButtons = div.querySelectorAll('.lp-insert-btn');
    lpInsertButtons.forEach(button => {
        button.addEventListener('click', function() {
            const sizeValue = this.dataset.size;

            if (!lastFocusedDetailsTextarea) {
                alert('内容欄をクリックしてから、サイズを選択してください');
                return;
            }

            // 現在の値に追加
            const currentValue = lastFocusedDetailsTextarea.value;
            if (currentValue && !currentValue.endsWith(',')) {
                lastFocusedDetailsTextarea.value = currentValue + ',' + sizeValue + ',';
            } else if (currentValue) {
                lastFocusedDetailsTextarea.value = currentValue + sizeValue + ',';
            } else {
                lastFocusedDetailsTextarea.value = sizeValue + ',';
            }

            // フォーカスを戻す
            lastFocusedDetailsTextarea.focus();
        });
    });

    // 料金表サイズ挿入ボタンのイベント
    const priceInsertButtons = div.querySelectorAll('.price-insert-btn');
    priceInsertButtons.forEach(button => {
        button.addEventListener('click', function() {
            const sizeValue = this.dataset.size;

            if (!lastFocusedDetailsTextarea) {
                alert('内容欄をクリックしてから、サイズを選択してください');
                return;
            }

            // 現在の値に追加
            const currentValue = lastFocusedDetailsTextarea.value;
            if (currentValue && !currentValue.endsWith(',')) {
                lastFocusedDetailsTextarea.value = currentValue + ',' + sizeValue + ',';
            } else if (currentValue) {
                lastFocusedDetailsTextarea.value = currentValue + sizeValue + ',';
            } else {
                lastFocusedDetailsTextarea.value = sizeValue + ',';
            }

            // フォーカスを戻す
            lastFocusedDetailsTextarea.focus();
        });
    });

    // グラビア挿入ボタンのイベント
    const gravureInsertButtons = div.querySelectorAll('.gravure-insert-btn');
    gravureInsertButtons.forEach(button => {
        button.addEventListener('click', function() {
            const sizeValue = this.dataset.size;

            if (!lastFocusedDetailsTextarea) {
                alert('内容欄をクリックしてから、サイズを選択してください');
                return;
            }

            // 現在の値に追加
            const currentValue = lastFocusedDetailsTextarea.value;
            if (currentValue && !currentValue.endsWith(',')) {
                lastFocusedDetailsTextarea.value = currentValue + ',' + sizeValue + ',';
            } else if (currentValue) {
                lastFocusedDetailsTextarea.value = currentValue + sizeValue + ',';
            } else {
                lastFocusedDetailsTextarea.value = sizeValue + ',';
            }

            // フォーカスを戻す
            lastFocusedDetailsTextarea.focus();
        });
    });

    // 印刷サイズ挿入ボタンのイベント
    const printInsertButtons = div.querySelectorAll('.print-size-insert-btn');
    printInsertButtons.forEach(button => {
        button.addEventListener('click', function() {
            const printSize = this.getAttribute('data-print-size');

            if (!lastFocusedDetailsTextarea) {
                alert('内容欄をクリックしてから、サイズを選択してください');
                return;
            }

            // 現在の値に追加
            const currentValue = lastFocusedDetailsTextarea.value;
            if (currentValue && !currentValue.endsWith(',')) {
                lastFocusedDetailsTextarea.value = currentValue + ',' + printSize + ': 枚,';
            } else if (currentValue) {
                lastFocusedDetailsTextarea.value = currentValue + printSize + ': 枚,';
            } else {
                lastFocusedDetailsTextarea.value = printSize + ': 枚,';
            }

            // フォーカスを戻す
            lastFocusedDetailsTextarea.focus();
        });
    });

    // 注釈挿入ボタンのイベント
    const annotationInsertButtons = div.querySelectorAll('.annotation-insert-btn');
    annotationInsertButtons.forEach(button => {
        button.addEventListener('click', function() {
            const annotationValue = this.dataset.annotation;

            if (!lastFocusedDetailsTextarea) {
                alert('内容欄をクリックしてから、注釈を選択してください');
                return;
            }

            // 現在の値に追加
            const currentValue = lastFocusedDetailsTextarea.value;
            if (currentValue && !currentValue.endsWith(',')) {
                lastFocusedDetailsTextarea.value = currentValue + annotationValue;
            } else if (currentValue) {
                lastFocusedDetailsTextarea.value = currentValue + annotationValue;
            } else {
                lastFocusedDetailsTextarea.value = annotationValue;
            }

            // フォーカスを戻す
            lastFocusedDetailsTextarea.focus();
        });
    });

    // LP注釈挿入ボタンのイベント
    const lpAnnotationInsertButtons = div.querySelectorAll('.lp-annotation-insert-btn');
    lpAnnotationInsertButtons.forEach(button => {
        button.addEventListener('click', function() {
            const lpAnnotationValue = this.dataset.annotation;

            if (!lastFocusedDetailsTextarea) {
                alert('内容欄をクリックしてから、LP注釈を選択してください');
                return;
            }

            // 現在の値に追加
            const currentValue = lastFocusedDetailsTextarea.value;
            if (currentValue && !currentValue.endsWith(',')) {
                lastFocusedDetailsTextarea.value = currentValue + lpAnnotationValue;
            } else if (currentValue) {
                lastFocusedDetailsTextarea.value = currentValue + lpAnnotationValue;
            } else {
                lastFocusedDetailsTextarea.value = lpAnnotationValue;
            }

            // フォーカスを戻す
            lastFocusedDetailsTextarea.focus();
        });
    });

    // 料金表注釈挿入ボタンのイベント
    const priceAnnotationInsertButtons = div.querySelectorAll('.price-annotation-insert-btn');
    priceAnnotationInsertButtons.forEach(button => {
        button.addEventListener('click', function() {
            const priceAnnotationValue = this.dataset.annotation;

            if (!lastFocusedDetailsTextarea) {
                alert('内容欄をクリックしてから、料金表注釈を選択してください');
                return;
            }

            // 現在の値に追加
            const currentValue = lastFocusedDetailsTextarea.value;
            if (currentValue && !currentValue.endsWith(',')) {
                lastFocusedDetailsTextarea.value = currentValue + priceAnnotationValue;
            } else if (currentValue) {
                lastFocusedDetailsTextarea.value = currentValue + priceAnnotationValue;
            } else {
                lastFocusedDetailsTextarea.value = priceAnnotationValue;
            }

            // フォーカスを戻す
            lastFocusedDetailsTextarea.focus();
        });
    });

    sizeButtons.forEach(button => {
        // 初期テキストを保存（HTML側で data-original-text を付けている場合は不要）
        if (!button.dataset.originalText) {
            button.dataset.originalText = button.textContent.trim();
        }

        button.addEventListener('click', function() {
            const targetId = this.dataset.target;
            const targetBlock = document.getElementById(targetId);

            if (targetBlock) {
                targetBlock.classList.toggle('hidden');

                if (targetBlock.classList.contains('hidden')) {
                    // 隠れた → 元のテキストに戻す（＋アイコン付き）
                    this.innerHTML = `${this.dataset.originalText} <i class="fas fa-plus-circle"></i>`;
                } else {
                    // 表示された → CLOSE（−アイコン付き）
                    this.innerHTML = `CLOSE <i class="fas fa-minus-circle"></i>`;
                }
            }
        });
    });

    // 最後にフォーカスされた内容または備考のtextareaを追跡
    let lastFocusedDetailsTextarea = null;

    // すべてのtextareaにフォーカスイベントを設定
    div.addEventListener('focusin', (e) => {
        // 'sync-target' (内容) または 'note-box' (備考) のクラスを持つ場合
        if (e.target.classList.contains('sync-target') || e.target.classList.contains('note-box')) {
            lastFocusedDetailsTextarea = e.target;
        }
    });

    // 削除ボタンのイベント
    const deleteBtn = div.querySelector('.delete-request-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', function() {
            const remainingSets = document.querySelectorAll('.request-set').length;
            if (remainingSets <= 1) {
                alert('最低1つのフォームは必要です。');
                return;
            }
            if (confirm('このフォームを削除しますか?')) {
                div.remove();
            }
        });
    }
}

// ファイルアップロード機能のセットアップ
function setupFileUpload(requestId) {
    const dropzone = document.getElementById(`fileDropzone_${requestId}`);
    const fileInput = document.getElementById(`zipFileInput_${requestId}`);
    const fileSelectBtn = document.getElementById(`fileSelectBtn_${requestId}`);
    const fileList = document.getElementById(`fileList_${requestId}`);

    // ファイル選択ボタンのクリックイベント
    fileSelectBtn.addEventListener('click', () => {
        fileInput.click();
    });

    // ファイル選択時の処理
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files, requestId);
    });

    // ドラッグオーバー時の処理
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    // ドラッグリーブ時の処理
    dropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
    });

    // ドロップ時の処理
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files, requestId);
    });
}



// ファイル処理関数
function handleFiles(files, requestId) {
    const fileList = document.getElementById(`fileList_${requestId}`);
    const maxSize = CONFIG.MAX_FILE_SIZE; // 500MB

    Array.from(files).forEach(file => {
        // ZIPファイルかチェック
        if (!file.name.toLowerCase().endsWith('.zip')) {
            alert(`${file.name} はZIPファイルではありません。`);
            return;
        }

        // ファイルサイズチェック
        if (file.size > maxSize) {
            const maxSizeMB = maxSize / 1024 / 1024;
            alert(`${file.name} のサイズが${maxSizeMB}MBを超えています。\n\nファイルを分割するか、圧縮率を上げてください。`);
            return;
        }

        // ファイル情報を表示
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <i class="fas fa-file-archive"></i>
            <span class="file-name">${file.name}</span>
            <span class="file-size">(${(file.size / 1024 / 1024).toFixed(2)} MB)</span>
            <button type="button" class="remove-file-btn" data-file-name="${file.name}">
                <i class="fas fa-times"></i>
            </button>
        `;

        fileList.appendChild(fileItem);

        // ファイルをBlob形式で保存（Base64は不要）
        fileItem.setAttribute('data-file-blob', file);
        fileItem.setAttribute('data-file-name', file.name);
        fileItem.setAttribute('data-file-size', file.size);

        // 削除ボタンのイベント
        const removeBtn = fileItem.querySelector('.remove-file-btn');
        removeBtn.addEventListener('click', () => {
            fileItem.remove();
        });
    });
}



// イベントハンドラの設定を関数化(初期化後に呼ぶため)
function setupEventHandlers() {
    document.getElementById("addRequest").addEventListener("click", createRequestSet);

    document.getElementById("mainForm").addEventListener("submit", async function(e) {
        e.preventDefault();

        // カスタムバリデーション: 依頼メンバーのチェック
        const requestSets = document.querySelectorAll('.request-set');
        let validationError = false;

        for (const requestSet of requestSets) {
            const requestId = requestSet.getAttribute('data-request-id');
            const memberSelect = requestSet.querySelector(`select[name="member_${requestId}"]`);
            const memberCustomInput = requestSet.querySelector(`input[name="member_custom_${requestId}"]`);

            if (memberSelect && memberCustomInput) {
                const selectValue = memberSelect.value;
                const customValue = memberCustomInput.value.trim();

                // セレクトが未選択 かつ カスタム入力も空の場合
                if (selectValue === '' && customValue === '') {
                    alert('依頼メンバーを選択するか、未登録者の名前を入力してください。');
                    memberSelect.focus();
                    validationError = true;
                    break;
                }

                // 未登録者を選択したのにカスタム入力が空の場合
                if (selectValue === '未登録者' && customValue === '') {
                    alert('未登録者を選択した場合は、名前を入力してください。');
                    memberCustomInput.focus();
                    validationError = true;
                    break;
                }
            }
        }

        if (validationError) {
            return;
        }

        const submitBtn = document.getElementById("submitBtn");
        const resultDiv = document.getElementById("result");

        // ボタンを無効化
        submitBtn.disabled = true;
        submitBtn.textContent = '・・・送信中・・・';
        resultDiv.style.display = 'none';

        const requests = [];
        let uploadResults = {
            success: 0,
            error: 0,
            errors: []
        };

        // 各request-setを処理
        for (const requestSet of requestSets) {
            const requestId = requestSet.getAttribute('data-request-id');

            // メンバー名の決定
            const memberSelect = requestSet.querySelector(`select[name="member_${requestId}"]`);
            const memberCustomInput = requestSet.querySelector(`input[name="member_custom_${requestId}"]`);
            let memberName = memberSelect ? memberSelect.value : '';
            const memberCustom = memberCustomInput ? memberCustomInput.value : '';
            if (memberCustom && memberCustom.trim() !== '') {
                memberName = memberCustom;
            }

            // 店舗名の取得
            const placeInput = requestSet.querySelector(`input[name="place_${requestId}"]`);
            const placeSelect = requestSet.querySelector(`select[name="place_${requestId}"]`);
            const place = placeInput ? placeInput.value : (placeSelect ? placeSelect.value : '');

            // 業務区分の取得
            const businessSelect = requestSet.querySelector(`select[name="business_${requestId}"]`);
            const business = businessSelect ? businessSelect.value : '';

            // チェックされた作業区分を取得
            const checkedCategories = requestSet.querySelectorAll(`input[name="work_category_${requestId}"]:checked`);

            // アップロードファイルの取得（フォーム送信後に別途アップロード）
            const fileItems = requestSet.querySelectorAll('.file-item');
            console.log('request-set ' + requestId + ' のアップロードファイル数:', fileItems.length);

            // ファイルアイテムを保存（フォーム送信後にアップロード）
            fileItems.forEach(item => {
                const fileBlob = item.getAttribute('data-file-blob');
                const fileName = item.getAttribute('data-file-name');
                const fileSize = item.getAttribute('data-file-size');

                // ファイルBlob参照を保存
                item._fileBlob = fileBlob instanceof Blob ? fileBlob : null;
            });

            // 共通データ
            const commonData = {
                requestId: requestId,
                member: memberName,
                member_custom: memberCustom,
                group: CONFIG.GROUP_NAME_FROM_SHEET,
                place: place,
                business: business
            };

            // 作業区分が選択されていない場合は1行だけ作成
            if (checkedCategories.length === 0) {
                requests.push({
                    ...commonData,
                    category: '',
                    details: '',
                    pattern: '',
                    sizeCount: '',
                    note: ''
                });
            } else {
                // 各作業区分ごとにパターンを処理
                checkedCategories.forEach(checkbox => {
                    const categoryValue = checkbox.value;

                    // この作業区分に対応するアコーディオンアイテムを取得
                    const accordionItem = Array.from(requestSet.querySelectorAll('.accordion-item')).find(item => {
                        const enableCheck = item.querySelector('.enable-check');
                        return enableCheck && enableCheck.value === categoryValue && enableCheck.checked;
                    });

                    // パターンブロックを取得（この作業区分のもののみ）
                    const patternBlocks = accordionItem ? accordionItem.querySelectorAll('.pattern-block') : [];

                    if (patternBlocks.length === 0) {
                        // パターンが設定されていない場合は1行だけ作成
                        requests.push({
                            ...commonData,
                            category: categoryValue,
                            details: '',
                            pattern: '',
                            sizeCount: '',
                            note: ''
                        });
                    } else {
                        // 各パターンごとに行を作成
                        patternBlocks.forEach((block, index) => {
                            const patternIndex = index + 1;

                            const patternTextInput = block.querySelector(`input[name="pattern_text_${requestId}_${categoryValue}_${patternIndex}"]`);
                            const sizeCountInput = block.querySelector(`input[name="size_count_${requestId}_${categoryValue}_${patternIndex}"]`);
                            const detailsTextarea = block.querySelector(`textarea[name="details_${requestId}_${categoryValue}_${patternIndex}"]`);
                            const noteTextarea = block.querySelector(`textarea[name="note_${requestId}_${categoryValue}_${patternIndex}"]`);

                            const patternText = patternTextInput ? (patternTextInput.value || patternTextInput.placeholder) : '';
                            const sizeCount = sizeCountInput ? sizeCountInput.value : '';
                            const details = detailsTextarea ? detailsTextarea.value : '';
                            const note = noteTextarea ? noteTextarea.value : '';

                            requests.push({
                                ...commonData,
                                category: categoryValue,
                                pattern: patternText,
                                sizeCount: sizeCount,
                                details: details,
                                note: note
                            });
                        });
                    }
                });
            }
        }

        try {
            // リクエストデータを作成
            const requestData = {
                requests: requests,
                auth_password: CONFIG.AUTH_PASSWORD
            };

            // ZIPファイルの有無フラグを各requestに追加
            requestData.requests = requestData.requests.map(req => {
                const requestSet = document.querySelector(`.request-set[data-request-id="${req.requestId}"]`);
                if (requestSet) {
                    const fileItems = requestSet.querySelectorAll('.file-item');
                    req.hasZipFile = fileItems.length > 0;
                } else {
                    req.hasZipFile = false;
                }
                return req;
            });

            const jsonData = JSON.stringify(requestData);
            const dataSizeMB = jsonData.length / 1024 / 1024;
            console.log('送信データサイズ:', dataSizeMB.toFixed(2), 'MB');

            // POSTリクエスト送信（GAS側へ）
            const response = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: jsonData
            });



            // レスポンスのチェック
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // レスポンスを解析
            const result = await response.json();
            console.log('サーバーレスポンス:', result);

            if (result.result === 'success') {
                let message = "フォーム送信が完了しました!";
                resultDiv.textContent = message;
                resultDiv.className = 'success';
                resultDiv.style.display = 'block';

                // ZIPファイルがあれば別途アップロード
                const allFileItems = document.querySelectorAll('.file-item');
                if (allFileItems.length > 0 && CONFIG.UPLOAD_ENABLED) {
                    console.log(`アップロード対象ファイル: ${allFileItems.length}個`);

                    for (const fileItem of allFileItems) {
                        // fileItemには _fileBlob が保存されている
                        const fileBlob = fileItem._fileBlob;
                        const fileName = fileItem.getAttribute('data-file-name');

                        if (fileBlob) {
                            try {
                                await uploadFileToServer(fileBlob, fileName);
                                uploadResults.success++;
                            } catch (uploadError) {
                                uploadResults.error++;
                                uploadResults.errors.push({
                                    fileName: fileName,
                                    error: uploadError.message
                                });
                            }
                        }
                    }

                    // アップロード結果を表示
                    if (uploadResults.success > 0) {
                        message += `\n\nファイルアップロード: ${uploadResults.success}件成功`;
                    }
                    if (uploadResults.error > 0) {
                        message += `\n\n⚠️ ファイルアップロード失敗: ${uploadResults.error}件`;
                        uploadResults.errors.forEach(err => {
                            message += `\n- ${err.fileName}: ${err.error}`;
                        });
                    }

                    resultDiv.textContent = message;
                    resultDiv.className = uploadResults.error > 0 ? 'warning' : 'success';
                }

                // フォームをリセット
                this.reset();
                document.getElementById("requestContainer").innerHTML = "";
                requestCount = 0;
                createRequestSet();
                updateMemberDropdowns();
            } else {
                throw new Error(result.message || '送信に失敗しました');
            }
        } catch (error) {
            console.error('Error:', error);
            console.error('Error details:', error.message);

            // より詳細なエラー情報を表示
            let errorMessage = `送信に失敗しました。\nエラー: ${error.message}`;
            if (error.stack) {
                console.error('Error stack:', error.stack);
            }

            resultDiv.textContent = errorMessage;
            resultDiv.className = 'error';
            resultDiv.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '送信';
        }
    });

    // サーバーへファイルをアップロード
    async function uploadFileToServer(fileBlob, fileName) {
        if (!CONFIG.UPLOAD_ENABLED) {
            throw new Error('アップロード機能が無効です');
        }

        try {
            const formData = new FormData();
            formData.append('file', fileBlob, fileName);

            // アップロード実行
            const response = await fetch(CONFIG.UPLOAD_API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'X-Group-Token': CONFIG.GROUP_TOKEN
                },
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                console.log(`✅ ファイルアップロード成功: ${fileName}`);
                return result;
            } else {
                throw new Error(result.error || 'アップロード失敗');
            }

        } catch (error) {
            console.error(`ファイルアップロードエラー (${fileName}):`, error);
            throw error;
        }
    }
}

// DOM読み込み完了後に認証フロー(initApp)を開始
document.addEventListener('DOMContentLoaded', initApp);