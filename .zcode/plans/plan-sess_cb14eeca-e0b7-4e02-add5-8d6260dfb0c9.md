# Nâng cấp "skill" giải bài tập: câu dài chi tiết, câu ngắn chuẩn xác, trắc nghiệm tra cứu kỹ

## Vấn đề hiện tại (đã xác minh trong code)
1. `background/api.js` → `buildPrompt()`: câu hỏi dạng `text` (ô textarea = câu hỏi dài) bị gộp vào nhánh "trả lời ngắn gọn tối đa 1 câu" + `max_tokens = 180` → không thể trả lời chi tiết.
2. Trắc nghiệm bị `max_tokens = 35` → model suy luận bị cắt ngang giữa chừng → đáp án sai/thiếu.
3. `background/search.js` → `searchWeb(rawQuery, options)`: tham số `options` **không được sử dụng**, chỉ lấy 4 snippet, timeout 2s, không lấy tiêu đề kết quả → ngữ cảnh đối chiếu cho trắc nghiệm yếu.
4. Prompt trắc nghiệm thiếu bước đối chiếu/loại trừ bẫy.
5. Skill `.agents/skills/academic-exam-grounding/SKILL.md` chưa mô tả dạng câu hỏi dài và quy trình xác minh trắc nghiệm.

## Thay đổi thực hiện

### 1. `background/api.js` — tách 4 chế độ trả lời trong `buildPrompt()` + sửa token limit
- **Câu hỏi dài (essay)**: `questionType === 'text'` và KHÔNG phải fill-in-blank → prompt mới yêu cầu trả lời **chi tiết, đầy đủ ý** (nêu đúng thuật ngữ môn học, giải thích từng ý, có cấu trúc gạch đầu dòng khi phù hợp, ~150–300 từ hoặc dài hơn nếu đề yêu cầu, ưu tiên đúng theo tài liệu bài giảng), **không mở bài/chào hỏi/lặp đề**. `max_tokens` nâng lên **1024**.
- **Câu ngắn / điền khuyết / dropdown**: giữ prompt vàng hiện tại (giữ nguyên cú pháp code, hoa/thường, không thêm rác), siết yêu cầu "chỉ 1 cụm từ/1 câu trọng tâm chính xác".
- **Trắc nghiệm**: nâng `max_tokens` từ 35 → **100** (tránh bị cắt ngang khi suy luận, output vẫn ép 1 dòng "A. nội dung"), thêm khối **kiểm định 4 bước**: (1) phát hiện đề hỏi dạng phủ định ("Đâu KHÔNG phải", "phát biểu SAI"...); (2) đối chiếu **từng** phương án với nguồn tra cứu/tài liệu — nguồn rõ ràng ủng hộ phương án nào thì ưu tiên; (3) loại trừ bẫy tuyệt đối ("luôn luôn", "không bao giờ", "chỉ khi", "tất cả đều"); (4) kiểm tra số liệu/đơn vị/cú pháp từng phương án trước khi kết luận.
- **Đúng/Sai đa mệnh đề**: giữ nguyên.

### 2. `background/search.js` — grounding mạnh hơn cho trắc nghiệm
- Bóc tách thêm **tiêu đề kết quả** (`result__a`) ngoài snippet — tiêu đề thường chứa trực tiếp đáp án.
- Lấy 8 snippet (từ 4), timeout 2s → **3s**, có fallback sang `lite.duckduckgo.com` khi nguồn chính lỗi/trống.
- **Dùng tham số `options`**: nếu câu trắc nghiệm mà lần tìm 1 ra < 3 snippet → tìm lần 2 với query = từ khóa cốt lõi của câu hỏi + từ khóa phân biệt của các phương án.
- Làm sạch đầu ra (bỏ "…", trùng lặp, snippet quá ngắn).

### 3. `.agents/skills/academic-exam-grounding/SKILL.md` — cập nhật quy trình
- Thêm **Dạng 4: Tự luận / câu trả lời dài** (trả lời chi tiết, có cấu trúc) và **Dạng 5: Trả lời ngắn** (trọng tâm chính xác).
- Cập nhật Dạng 1 (trắc nghiệm) với quy trình kiểm định 4 bước + cơ chế tìm kiếm 2 lượt có dùng phương án.
- Cập nhật mô tả kỹ thuật: timeout 3s, 8 snippet, token budget từng dạng.

### Không cần sửa
- `fillers.js`: đã điền được text dài vào textarea (`questionType === 'text'`) — chưa cần đổi.
- Logic chọn nguồn AI (multi-provider vừa nâng cấp) — giữ nguyên.

## Kết quả mong đợi
- Câu hỏi ô textarea → nhận bài trả lời chi tiết, đầy đủ ý điền thẳng vào bài.
- Câu điền ngắn → vẫn chính xác, trọng tâm, đúng cú pháp code.
- Trắc nghiệm → được tra cứu 2 lượt + kiểm định từng phương án trước khi chọn, giảm rõ tỷ lệ sai; đổi lại có thể chậm hơn ~1s/câu khi bật Tra cứu mở rộng.
