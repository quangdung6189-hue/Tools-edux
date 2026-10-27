# Tools_-_edux_

Extension Chrome "Auto Homework Solver" — tự động quét câu hỏi bài tập từ trang LMS, gọi AI (9Router local, Onimi / router local khác, Gemini, OpenRouter, Groq, ...) trả lời và điền đáp án.

## Tính năng
- Quét câu hỏi trắc nghiệm / đúng-sai / điền khuyết / tự luận trên trang LMS (Edux, CMCU...).
- Auto All: tự giải toàn bộ đề, tự chuyển câu.
- Hỗ trợ nhiều nguồn AI: 9Router Proxy (local `http://localhost:20128/v1`), Onimi / router local khác (Base URL tùy chỉnh), Google Gemini trực tiếp, nguồn tùy chỉnh OpenAI-compatible.
- Fix tương thích Onimi: không ép model `ag/...`, không gửi tham số reasoning riêng của 9Router, tự retry payload tối giản khi HTTP 400, vòng Auto bỏ qua câu lỗi thay vì dừng cả loạt.

## Cài đặt (chế độ developer)
1. Mở `chrome://extensions`, bật Developer mode.
2. Load unpacked → chọn thư mục này.
3. Mở Side Panel extension → Cài đặt → chọn nguồn AI + Base URL + API key + Model.

## Cấu trúc
- `manifest.json` — khai báo extension (MV3).
- `background/` — service worker, gọi AI (`api.js`), tìm kiếm đối chiếu (`search.js`).
- `content/` — quét câu hỏi, điền đáp án, auto solver, floating bar.
- `sidepanel/` — giao diện điều khiển.
