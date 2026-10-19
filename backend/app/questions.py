"""Ngân hàng câu hỏi mẫu theo vị trí luyện tập."""

QUESTION_BANK: dict[str, list[dict]] = {
    "Backend Developer": [
        {
            "group": "Kiến thức chuyên môn",
            "text": "Bạn giải thích REST API là gì và các phương thức HTTP thường dùng?",
            "keywords": ["REST", "resource", "HTTP", "GET", "POST", "PUT", "PATCH", "DELETE", "status code"],
            "difficulty": "Dễ",
            "answer_tips": [
                "Định nghĩa REST API theo resource và chuẩn HTTP.",
                "Nêu đúng ý nghĩa GET, POST, PUT/PATCH, DELETE.",
                "Nhắc status code và ví dụ endpoint cụ thể.",
            ],
            "sample_answer": "REST API là kiểu thiết kế API trong đó client thao tác với các resource thông qua HTTP. Mỗi resource thường có URI rõ ràng, ví dụ /users hoặc /orders/1. GET dùng để lấy dữ liệu, POST dùng để tạo mới, PUT thường cập nhật toàn bộ resource, PATCH cập nhật một phần, DELETE dùng để xóa. API nên trả status code phù hợp như 200 khi thành công, 201 khi tạo mới, 400 khi request sai, 401/403 khi lỗi xác thực hoặc phân quyền, 404 khi không tìm thấy và 500 khi lỗi server. Một REST API tốt cần nhất quán, stateless và dễ hiểu cho client.",
        },
        {
            "group": "Cơ sở dữ liệu",
            "text": "Index trong SQL hoạt động như thế nào và khi nào nên tạo index?",
            "keywords": ["index", "SQL", "query", "B-tree", "where", "join", "order by", "write cost"],
            "difficulty": "Trung bình",
            "answer_tips": [
                "Giải thích index như cấu trúc tra cứu, thường là B-tree.",
                "Nêu trường hợp nên tạo index: WHERE, JOIN, ORDER BY, khóa ngoại.",
                "Nêu trade-off: tăng tốc đọc nhưng tốn dung lượng và làm chậm ghi.",
            ],
            "sample_answer": "Index trong SQL là cấu trúc dữ liệu phụ giúp database tìm bản ghi nhanh hơn thay vì quét toàn bộ bảng. Nhiều hệ quản trị dùng B-tree index, phù hợp cho tìm kiếm theo điều kiện, sắp xếp và range query. Tôi nên tạo index cho các cột xuất hiện thường xuyên trong WHERE, JOIN, ORDER BY, GROUP BY hoặc các cột khóa ngoại có truy vấn nhiều. Tuy nhiên không nên tạo index bừa bãi vì index tốn dung lượng và làm INSERT, UPDATE, DELETE chậm hơn do database phải cập nhật thêm cấu trúc index. Khi tối ưu, tôi sẽ xem execution plan để biết query có dùng index hiệu quả hay không.",
        },
        {
            "group": "Bảo mật",
            "text": "Authentication và Authorization khác nhau thế nào? Bạn từng dùng JWT hay session?",
            "keywords": ["authentication", "authorization", "JWT", "session", "token", "role", "permission"],
            "difficulty": "Trung bình",
            "answer_tips": [
                "Phân biệt authentication là xác thực danh tính, authorization là kiểm tra quyền.",
                "So sánh session stateful và JWT stateless.",
                "Nêu cách bảo vệ token/session và kiểm tra role.",
            ],
            "sample_answer": "Authentication là quá trình xác minh người dùng là ai, ví dụ đăng nhập bằng email và mật khẩu. Authorization là kiểm tra người dùng đã đăng nhập đó được phép làm gì, ví dụ user thường không được vào trang admin. Với session, server lưu trạng thái đăng nhập và client giữ session id trong cookie; cách này dễ thu hồi session nhưng cần lưu state phía server. Với JWT, server ký token chứa thông tin người dùng hoặc role, client gửi token trong mỗi request; ưu điểm là stateless nhưng cần xử lý thời hạn token, refresh token và bảo mật nơi lưu token. Trong hệ thống có phân quyền, backend vẫn phải kiểm tra role/permission ở từng endpoint quan trọng, không chỉ ẩn nút ở frontend.",
        },
        {
            "group": "Xử lý lỗi & chất lượng",
            "text": "Bạn xử lý Error Handling và viết Unit Test cho service như thế nào?",
            "keywords": ["error handling", "validation", "exception", "unit test", "mock", "arrange act assert"],
            "difficulty": "Trung bình",
            "answer_tips": [
                "Chia lỗi thành validation, business và system error.",
                "Trả lỗi nhất quán, không lộ thông tin nhạy cảm.",
                "Unit test theo Arrange-Act-Assert và mock dependency.",
            ],
            "sample_answer": "Tôi xử lý lỗi bằng cách phân loại rõ: lỗi validation do input không hợp lệ, lỗi nghiệp vụ do vi phạm rule, và lỗi hệ thống như database hoặc service ngoài bị lỗi. API nên trả response nhất quán gồm mã lỗi, thông điệp dễ hiểu và status code phù hợp, đồng thời log chi tiết ở server nhưng không trả stack trace cho client. Với unit test cho service, tôi dùng cấu trúc Arrange-Act-Assert: chuẩn bị dữ liệu và mock dependency, gọi hàm cần test, sau đó kiểm tra kết quả hoặc exception. Tôi sẽ test cả case thành công, input sai, boundary case và dependency lỗi để đảm bảo service ổn định.",
        },
        {
            "group": "Tư duy giải quyết vấn đề",
            "text": "Kể một tình huống bạn tối ưu hiệu năng API hoặc truy vấn chậm (theo STAR).",
            "keywords": ["situation", "task", "action", "result", "N+1", "index", "cache", "execution plan"],
            "difficulty": "Khó",
            "answer_tips": [
                "Trả lời theo STAR: Situation, Task, Action, Result.",
                "Nêu nguyên nhân kỹ thuật cụ thể như N+1, thiếu index, payload lớn.",
                "Nêu kết quả đo được trước/sau.",
            ],
            "sample_answer": "Situation: Trong một API danh sách đơn hàng, thời gian phản hồi tăng mạnh khi dữ liệu nhiều. Task: Tôi cần xác định nguyên nhân và giảm thời gian phản hồi. Action: Tôi kiểm tra log SQL và phát hiện lỗi N+1 khi mỗi đơn hàng lại query thêm thông tin khách hàng. Tôi sửa bằng eager loading hoặc join hợp lý, thêm index cho cột thường lọc, giới hạn field trả về và phân trang dữ liệu. Nếu dữ liệu ít thay đổi, tôi có thể thêm cache cho endpoint đọc nhiều. Result: Số query giảm đáng kể, thời gian phản hồi ổn định hơn và API chịu tải tốt hơn. Điểm quan trọng là phải đo bằng log, execution plan hoặc metric trước khi tối ưu.",
        },
    ],
    "Frontend Developer": [
        {
            "group": "Kiến thức chuyên môn",
            "text": "React state và props khác nhau thế nào? Khi nào dùng useEffect?",
            "keywords": ["React", "state", "props", "useEffect", "component", "side effect"],
            "difficulty": "Dễ",
            "answer_tips": [
                "Props là dữ liệu truyền từ component cha xuống, state là dữ liệu nội bộ.",
                "State thay đổi làm component render lại.",
                "useEffect dùng cho side effect, không dùng thay thế toàn bộ logic render.",
            ],
            "sample_answer": "Props là dữ liệu component nhận từ bên ngoài, thường từ component cha truyền xuống, và component con không nên tự sửa trực tiếp props. State là dữ liệu nội bộ của component, khi state thay đổi thì React render lại UI tương ứng. useEffect dùng để xử lý side effect sau render, ví dụ gọi API, đăng ký event listener, set timer hoặc đồng bộ với localStorage. Khi dùng useEffect cần chú ý dependency array để tránh chạy thiếu hoặc chạy lặp vô hạn, và nên cleanup các effect như event listener hoặc interval khi component unmount.",
        },
        {
            "group": "Hiệu năng",
            "text": "Bạn tối ưu render và bundle size trên frontend ra sao?",
            "keywords": ["memo", "useMemo", "useCallback", "lazy", "code splitting", "bundle"],
            "difficulty": "Trung bình",
            "answer_tips": [
                "Đo bằng React Profiler/Lighthouse trước khi tối ưu.",
                "Tối ưu render bằng memoization đúng chỗ.",
                "Giảm bundle bằng lazy loading, code splitting và import chọn lọc.",
            ],
            "sample_answer": "Tôi không tối ưu cảm tính mà đo trước bằng React Profiler, Lighthouse hoặc tab Performance. Với render, tôi kiểm tra component render lại không cần thiết, tách component hợp lý và dùng React.memo, useMemo hoặc useCallback khi dependency ổn định và thực sự có lợi. Với danh sách lớn, tôi dùng pagination hoặc virtualized list. Với bundle size, tôi dùng lazy loading, code splitting theo route, import chọn lọc thay vì import cả thư viện lớn và kiểm tra bundle analyzer nếu cần. Mục tiêu là giảm thời gian tải ban đầu và giữ UI phản hồi nhanh mà không làm code phức tạp quá mức.",
        },
        {
            "group": "API & bảo mật",
            "text": "Frontend gọi REST API và xử lý lỗi mạng như thế nào?",
            "keywords": ["fetch", "axios", "REST", "loading", "error", "401", "403", "CORS"],
            "difficulty": "Trung bình",
            "answer_tips": [
                "Có loading, error, empty state rõ ràng.",
                "Xử lý 401/403 riêng với lỗi server hoặc lỗi mạng.",
                "Không lưu secret ở frontend và không chỉ dựa vào frontend để bảo mật.",
            ],
            "sample_answer": "Khi frontend gọi REST API, tôi thường tạo một lớp client chung để cấu hình base URL, header, token và xử lý lỗi thống nhất. UI cần có loading state khi đang gọi API, error state khi thất bại và empty state khi không có dữ liệu. Với lỗi 401, tôi có thể xóa token và chuyển người dùng về trang đăng nhập; với 403, tôi báo không đủ quyền; với 500 hoặc lỗi mạng, tôi hiển thị thông báo phù hợp và có thể cho retry. Về bảo mật, frontend không được chứa secret, không tin tưởng dữ liệu phía client và các quyền quan trọng vẫn phải kiểm tra ở backend. CORS là cấu hình phía server để cho phép origin hợp lệ gọi API.",
        },
    ],
}

DEFAULT_QUESTIONS = QUESTION_BANK["Backend Developer"]


def get_questions_for_position(position: str) -> list[dict]:
    return QUESTION_BANK.get(position, DEFAULT_QUESTIONS)
