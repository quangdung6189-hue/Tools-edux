---
name: academic-exam-grounding
description: >-
  Kỹ thuật và quy trình giải đề thi, bài kiểm tra học thuật kết hợp tra cứu mở rộng bên ngoài
  (Web Grounding, Academic Search, Slide Knowledge, Domain Ontology) để đối chiếu lý thuyết
  chuẩn xác, triệt tiêu ảo giác (hallucination) và đảm bảo độ chính xác tuyệt đối.
---

# Academic Exam Grounding — Kỹ Thuật Giải Bài Kiểm Tra & Đối Chiếu Dữ Liệu Chuẩn Xác

Kỹ năng này hướng dẫn quy trình giải bài kiểm tra và bài thi học thuật (LMS, Edux, Coursera, Canvas, Blackboard...) với độ chính xác cao nhất thông qua việc **kết hợp tri thức nội tại của mô hình AI với dữ liệu tra cứu mở rộng bên ngoài (Grounding)**.

---

## 1. Triết Lý Tam Giác Đối Chiếu (Grounding Triangulation)

Một câu trả lời chỉ được xem là đạt chuẩn khi thỏa mãn **Ma trận Đối chiếu 3 lớp**:

```
                       ┌────────────────────────────────────────┐
                       │  1. TÀI LIỆU BÀI GIẢNG NỘI BỘ          │
                       │  (Slide Knowledge Cache & File Đính Kèm)│
                       └──────────────────┬─────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────┴─────────────────────────────────────────┐
│                           2. TRA CỨU MỞ RỘNG (WEB GROUNDING)                      │
│      - Sách giáo trình, tài liệu chuyên khảo, chuẩn RFC, IEEE, ISO, W3C            │
│      - Định nghĩa chính thức của tác giả/công nghệ (Microsoft Docs, Oracle, v.v.) │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │
                                          ▼
                       ┌──────────────────┴─────────────────────┐
                       │  3. SUY LUẬN LOGIC & BẢN CHẤT HỌC THUẬT│
                       │  (Elimination, Fact-checking, Syntax)   │
                       └────────────────────────────────────────┘
```

1. **Ưu tiên số 1 (Tài liệu bài giảng/Slide nội bộ)**: Khái niệm môn học thường tuân theo cách tiếp cận của giáo trình giảng dạy (ví dụ: định nghĩa ACID trong CSDL, mô hình thác nước trong CNPM).
2. **Ưu tiên số 2 (Tra cứu mở rộng chuẩn xác)**: Khi bài giảng không đủ chi tiết hoặc xuất hiện câu hỏi ứng dụng thực tế/công nghệ mới, kích hoạt tìm kiếm mở rộng (DuckDuckGo, Wikipedia tiếng Việt/Anh, Official Docs) để lấy trích dẫn gốc.
3. **Ưu tiên số 3 (Đối chiếu loại trừ)**: Đọc kỹ từng phương án A, B, C, D để loại trừ bẫy ngôn từ (các từ bẫy: *luôn luôn*, *không bao giờ*, *chỉ khi*, *tất cả đều đúng*).

---

## 2. Kỹ Thuật Trích Xuất Khái Niệm & Chuẩn Hóa Query Tìm Kiếm

Khi nhận một câu hỏi thi, **tuyệt đối không tìm kiếm nguyên cả câu hỏi dài dòng** vì công cụ tìm kiếm sẽ bị loãng kết quả. Hãy áp dụng quy trình chuẩn hóa query 3 bước:

### Bước 1: Loại bỏ nhiễu ngữ cảnh
- Bỏ tiền tố: `Câu 1:`, `Question 12:`, `[Trắc nghiệm]`, `Chọn đáp án đúng:`.
- Bỏ ký hiệu điền khuyết: `_____`, `[...]`, `chỗ trống (...)`.

### Bước 2: Trích xuất Cặp Thực thể - Vấn đề (Entity-Attribute Pair)
- *Ví dụ câu hỏi*: *"Nếu một giao dịch bao gồm nhiều thao tác và một thao tác thất bại, điều gì cần phải được thực hiện để đảm bảo tính toàn vẹn dữ liệu?"*
- *Thực thể cốt lõi*: `giao dịch ngân hàng`, `transaction database`.
- *Tính chất học thuật*: `tính toàn vẹn dữ liệu`, `ACID`, `Atomicity (Nguyên tử)`.
- *Hành động kỹ thuật chuẩn*: `Rollback`, `khôi phục trạng thái trước khi giao dịch`.

### Bước 3: Xây dựng Query Tìm Kiếm Tinh Gọn (High-Yield Search Queries)
- **Tiếng Việt**: `giao dịch thất bại đảm bảo toàn vẹn dữ liệu rollback`
- **Tiếng Anh / Kỹ thuật**: `database transaction fails rollback atomic consistency`
- **Quy tắc**: Giữ độ dài query từ **4 đến 8 từ khóa quan trọng nhất**.

---

## 3. Chiến Lược Giải Chuyên Sâu Từng Dạng Bài Thi

> **Nguyên tắc chọn chế độ trả lời (áp dụng trong `background/api.js` → `buildPrompt()`):**
>
> | Dạng bài | Điều kiện nhận diện | Kiểu trả lời | Token budget |
> |---|---|---|---|
> | Trắc nghiệm 1 lựa chọn | `multiple-choice`, có ≥ 2 phương án | đúng 1 dòng: `A. nội dung` | 64 |
> | Trắc nghiệm nhiều đáp án | `multiple-select` | 1 dòng: `A, C, D` (dấu phẩy) | 180 |
> | Đúng/Sai đa mệnh đề | `true-false` | Đủ N dòng `1. Đúng / 2. Sai` | 200 |
> | Điền khuyết / trả lời ngắn | `fill-in-the-blank`, `short-answer`, `dropdown` | 1 cụm từ / 1 câu lệnh chuẩn xác | 180 |
> | Tự luận / câu hỏi dài | `text` (ô textarea) hoặc đề yêu cầu trình bày, phân tích | **Chi tiết, đầy đủ ý, 150–300+ từ** | 1024 |
>
> ⚠️ Token budget trắc nghiệm cố tình giữ **nhỏ**: đủ chỗ cho "A. nội dung phương án" nhưng không đủ
> chỗ viết quá trình suy luận — model viết lan man sẽ bị cắt ngang làm hỏng chữ cái đáp án.

### Dạng 1: Trắc Nghiệm Một/Nhiều Lựa Chọn (Multiple Choice)
- **Gợi ý kiểm định ngầm 4 ý (nén thành 1 khối gợi ý trong prompt, TUYỆT ĐỐI không ghi ra output)**:
  1. **Bắt đề phủ định**: Nếu đề hỏi "Đâu **KHÔNG phải**...", "phát biểu **SAI**...", "**ngoại trừ**..." thì đáp án là phương án SAI nhất, không phải phương án đúng nhất.
  2. **Đối chiếu từng phương án A→D với nguồn**: So sánh lần lượt từng phương án với tài liệu bài giảng và snippet tra cứu. Nếu nguồn rõ ràng ủng hộ một phương án thì **ưu tiên nguồn**, kể cả khi cảm giác chủ quan nghiêng về phương án khác.
  3. **Loại trừ bẫy ngôn từ**: phương án chứa *luôn luôn, không bao giờ, chỉ khi, tất cả đều, bỏ qua* thường SAI — trừ khi lý thuyết chuẩn khẳng định điều đó.
  4. **Soát cuối**: kiểm tra số liệu, đơn vị, tên hàm, cú pháp của phương án được chọn khớp với lý thuyết chuẩn.
- **Chống sai do output đa dòng**: prompt đặt quy tắc "CHỈ 1 DÒNG" lên đầu và nhấn mạnh nhất; bên nhận (`extractAnswerLetter` ở `sidepanel/state.js` & `content/utils.js`) đọc **dòng cuối trước** rồi mới quét toàn bộ — nếu AI vẫn lỡ viết quá trình, chữ cái được lấy từ dòng kết luận chứ không nhặt nhầm chữ cái trong phần phân tích.
- **Tra cứu 2 lượt cho trắc nghiệm** (`background/search.js`):
  - Lượt 1: query chuẩn hóa từ câu hỏi (xem mục 2).
  - Lượt 2 (tự động khi lượt 1 ra < 3 snippet): query = từ khóa cốt lõi của câu hỏi + **từ khóa phân biệt dài nhất từ các phương án** — giúp tìm đúng trang thảo luận khái niệm chứa đáp án.
- **Đầu ra**: 1 dòng cuối duy nhất dạng `A. nội dung phương án`; với `multiple-select` liệt kê tất cả chữ cái cách nhau bởi dấu phẩy (`A, C, D`).

### Dạng 2: Đúng / Sai Đa Mệnh Đề (Multi-Statement True/False)
- **Đặc trưng**: Đề thi thường đưa ra 1 tình huống kèm theo 4 phát biểu con a), b), c), d).
- **Phương pháp**:
  - Không suy luận gộp. Tách riêng từng mệnh đề thành 1 câu khẳng định độc lập.
  - Tra cứu / xác thực tính đúng đắn của từng mệnh đề dựa trên lý thuyết chuẩn.
  - Chuẩn hóa đầu ra thành đúng định dạng 4 dòng:
    ```
    1. ĐÚNG
    2. SAI
    3. ĐÚNG
    4. SAI
    ```

### Dạng 3: Điền Khuyết Thuật Ngữ & Câu Lệnh Code (Fill-in-the-blank)
- **Đặc trưng**: Yêu cầu điền chính xác 1 từ/cụm từ hoặc 1 dòng lệnh lập trình (ASP.NET Core, Java, C#, SQL, Python).
- **Quy tắc vàng về Cú Pháp**:
  - **Câu lệnh (Statement)**: Phải giữ nguyên dấu ngoặc tròn `()` và dấu chấm phẩy `;` nếu ngôn ngữ bắt buộc (Ví dụ: `app.UseStaticFiles();`, `builder.Services.AddControllersWithViews();`).
  - **Tên phương thức/hàm**: Viết chuẩn PascalCase/camelCase (Ví dụ: `UseStaticFiles()`, `RenderBody()`).
  - **Tên thuộc tính/class**: Giữ đúng hoa/thường (Ví dụ: `DbContext`, `IActionResult`).
  - **Không thêm rác**: Không ghi thêm chữ *"Đáp án là:"*, không đóng mở ngoặc kép `""`, không in đậm `**`.

### Dạng 4: Tự Luận / Câu Hỏi Trả Lời Dài (Essay — ô textarea)
- **Đặc trưng**: Trang bài tập có ô `textarea` (scanner gán `questionType = 'text'`), hoặc đề yêu cầu *trình bày, phân tích, so sánh, giải thích...* → cần **trả lời CHI TIẾT, ĐẦY ĐỦ** (token budget **1024**).
- **Quy tắc viết**:
  1. **Câu đầu đi thẳng trọng tâm** — không mở bài xã giao ("Trong thời đại hiện nay..."), không lặp lại đề bài, không chào hỏi.
  2. **Đầy đủ ý chính**: liệt kê và giải thích ngắn gọn từng ý; dùng gạch đầu dòng / đánh số khi phù hợp.
  3. **Đúng thuật ngữ môn học**: ưu tiên dùng đúng cách diễn đạt của TÀI LIỆU BÀI GIẢNG (khối `TÀI LIỆU BÀI GIẢNG / TÀI LIỆU ĐÍNH KÈM` trong prompt).
  4. **Câu hỏi lập trình**: kèm code/ví dụ hoàn chỉnh, đúng cú pháp (đủ ngoặc `()`, dấu chấm phẩy `;`).
  5. **Độ dài**: khoảng 150–300 từ, dài hơn nếu đề yêu cầu chi tiết.
- **Lưu ý nhận diện**: câu `text` có chứa "điền / chỗ trống / ____" vẫn thuộc Dạng 3 (điền khuyết) chứ không phải tự luận.

### Dạng 5: Trả Lời Ngắn (Short Answer — ô input 1 dòng)
- **Đặc trưng**: Trang có ô `input[type=text]` (scanner gán `questionType = 'short-answer'`), hoặc `dropdown`.
- **Quy tắc**:
  1. Trả lời **TRỌNG TÂM**: 1 cụm từ / 1 con số / 1 thuật ngữ / tối đa 1 câu ngắn chính xác nhất.
  2. Giữ NGUYÊN hoa/thường (PascalCase, camelCase, UPPERCASE, từ viết tắt), đơn vị, tên hàm — áp dụng cùng Quy tắc vàng cú pháp của Dạng 3.
  3. Không tiền tố thừa, không giải thích, không trả lời dàn trải, không đưa nhiều phương án.

---

## 4. Tích Hợp Vào Auto Homework Solver Extension

Trong extension, tính năng Tra cứu Mở rộng được cấu hình và vận hành qua:

1. **`background/search.js`**:
   - Tìm kiếm DuckDuckGo HTML (`html.duckduckgo.com/html/`) với timeout 3s; tự fallback sang `lite.duckduckgo.com/lite/` khi nguồn chính bị chặn hoặc trả trống.
   - Bóc tách **cả tiêu đề kết quả (`result__a`) lẫn snippet (`result__snippet`)**, ghép cặp theo thứ tự — tiêu đề thường chứa trực tiếp đáp án.
   - Lấy tối đa **8 snippet** mỗi lượt; với trắc nghiệm, nếu lượt 1 ra < 3 snippet thì **tự tìm lượt 2** với query kết hợp từ khóa phương án.
   - Làm sạch HTML tags, entity ký tự, ký tự "…", khử trùng lặp.

2. **`background/api.js`**:
   - Khi `enableWebGrounding` được bật hoặc khi cần đối chiếu câu hỏi lý thuyết phức tạp, tự động gọi `searchWeb()` để lấy tối đa 8 đoạn trích dẫn.
   - Nhúng khối ngữ cảnh vào prompt:
     ```text
     === THÔNG TIN ĐỐI CHIẾU ===
     [1] Snippet/nguồn 1...
     [2] Snippet/nguồn 2...
     ```
   - Áp dụng bảng chọn chế độ trả lời ở đầu mục 3: tự luận (text/textarea) trả lời chi tiết với budget 1024 token; câu ngắn/điền khuyết trả lời trọng tâm 180 token; trắc nghiệm 64 token với gợi ý kiểm định ngầm; Đúng/Sai 200 token.
   - Tra cứu giới hạn tối đa **3 request/câu** (lượt 1 + fallback lite + lượt 2 không fallback), timeout 2.2s/request — tối đa ~6.6s, tránh làm đơ tiến trình Auto All.

3. **Chọn Model AI phù hợp cho Grounding**:
   - **`ag/gemini-3.8-flash-medium`** hoặc **`ag/gemini-3.8-flash-low`**: Cực nhanh, khả năng đọc và tổng hợp context tài liệu xuất sắc.
   - **`ag/gemini-pro-agent`** / **`ag/claude-sonnet-4-6`**: Khi gặp các câu hỏi toán học, giải thuật hóc búa cần suy luận nhiều bước.

---

## 5. Bảng Kiểm Tra Chất Lượng (Verification Checklist)

Trước khi điền đáp án vào bài kiểm tra, luôn kiểm tra qua bảng checklist:

- [ ] **Đúng câu hỏi chưa?** Đã loại bỏ các từ bẫy phủ định ("Đâu **không phải** là...", "Phát biểu nào **sai**...").
- [ ] **Đúng chế độ trả lời chưa?** Câu textarea → chi tiết đầy đủ (Dạng 4); câu input ngắn → trọng tâm (Dạng 5); trắc nghiệm → đã chạy đủ 4 bước kiểm định.
- [ ] **Khớp với giáo trình?** Thuật ngữ có đúng với bài giảng trên slide không?
- [ ] **Có trích dẫn xác thực?** Đáp án có nguồn lý thuyết đối chiếu rõ ràng không? Nguồn ủng hộ phương án thì ưu tiên nguồn.
- [ ] **Cú pháp code chuẩn 100%?** Không bị thiếu dấu chấm phẩy, ngoặc đơn, sai hoa thường?
- [ ] **Định dạng phản hồi gọn gàng?** Trắc nghiệm: chỉ 1 dòng "A. nội dung"; điền khuyết: chỉ nội dung cần điền; tự luận: chi tiết nhưng không rác xã giao.
