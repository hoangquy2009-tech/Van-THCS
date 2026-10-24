import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { FileText, Table, List, FileEdit, Printer, Upload, CheckCircle, Settings, Loader2, AlertCircle, BookOpen, Download, User, Phone } from 'lucide-react';
import * as mammoth from 'mammoth';
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from '@google/genai';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function App() {
  const [activeTab, setActiveTab] = useState('input');
  const [hasGenerated, setHasGenerated] = useState(false);
  
  // Trạng thái AI và Upload
  const [pl3Text, setPl3Text] = useState('');
  const [dtText, setDtText] = useState('');
  const [pl3FileName, setPl3FileName] = useState('');
  const [dtFileName, setDtFileName] = useState('');
  const [pl3FileText, setPl3FileText] = useState('');
  const [dtFileText, setDtFileText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [generationInfo, setGenerationInfo] = useState<{
    modelUsed?: string;
    cacheUsed?: boolean;
    cacheId?: string | null;
    charCount?: number;
    logs?: string[];
  } | null>(null);

  // Trạng thái lưu trữ cấu hình
  const [config, setConfig] = useState({
    subject: 'Ngữ văn',
    grade: '6',
    examType: 'Giữa kì 2',
    duration: '90 phút',
    difficulty: 'cơ bản',
    rates: {
      nb: 40,
      th: 30,
      vd: 30
    },
    objectives: {
      knowledge: ['Nhận biết được các yêu cầu của đề kiểm tra.', 'Hệ thống hóa kiến thức đã học.'],
      generalCompetence: ['Tự học, giải quyết vấn đề, sáng tạo, sử dụng ngôn ngữ, giao tiếp, thẩm mỹ.'],
      specificCompetence: ['HS nắm được bài kiểm tra có hai phần: Đọc hiểu và Viết.', 'Rèn kỹ năng sáng tạo khi làm bài.'],
      qualities: ['Làm bài nghiêm túc, đúng giờ, trung thực.']
    },
    materials: {
      teacher: 'SGK, SGV, đề kiểm tra, đáp án.',
      student: 'Ôn tập kiến thức đã học.'
    },
    reading: {
      textType: 'Truyện đồng thoại / Truyện ngắn',
      passage: '[Hệ thống sẽ tự động tạo ngữ liệu ngoài SGK dựa trên Phụ lục 3 sau khi phân tích...]',
      source: '',
      totalScoreInput: '6', // Input để trống sẽ lấy mặc định
      nb_scoreInput: '3', // Ô nhập điểm Nhận biết
      th_scoreInput: '2', // Ô nhập điểm Thông hiểu
      vd_scoreInput: '1', // Ô nhập điểm Vận dụng
      nb_count: 3,
      th_count: 2,
      vd_count: 1,
      mcq_multiple_choice_count: 0,
      mcq_true_false_count: 0,
      mcq_fill_blank_count: 0,
      questions: [
        { level: 'nb', type: 'essay', text: 'Xác định thể loại của văn bản?', points: 0.5, answer: 'Thể loại: Truyện...' },
        { level: 'nb', type: 'essay', text: 'Văn bản trên được kể theo ngôi thứ mấy?', points: 0.5, answer: 'Ngôi thứ...' },
        { level: 'nb', type: 'essay', text: 'Chỉ ra lời của người kể chuyện trong đoạn...?', points: 0.5, answer: 'Lời của...' },
        { level: 'nb', type: 'essay', text: 'Nhân vật đã có hành động gì?', points: 0.5, answer: 'Hành động...' },
        { level: 'th', type: 'essay', text: 'Chỉ ra và nêu tác dụng của biện pháp tu từ?', points: 1.0, answer: 'Biện pháp: ... Tác dụng: ...' },
        { level: 'th', type: 'essay', text: 'Nhân vật trong văn bản có đặc điểm gì nổi bật?', points: 1.0, answer: 'Nhân vật là người...' },
        { level: 'th', type: 'essay', text: 'Giải thích ý nghĩa của chi tiết...', points: 1.0, answer: 'Ý nghĩa...' },
        { level: 'vd', type: 'essay', text: 'Từ hành động của nhân vật, em rút ra bài học gì?', points: 1.0, answer: 'Bài học rút ra...' },
      ],
      criteria: { 
        nb: ['Nêu được ấn tượng chung về văn bản.', 'Nhận biết được chi tiết, nhân vật, đề tài, ngôi kể.', 'Nhận ra từ đơn, từ phức, biện pháp tu từ.'], 
        th: ['Tóm tắt được cốt truyện, nêu được chủ đề.', 'Phân tích được đặc điểm nhân vật.', 'Xác định nghĩa của từ, tác dụng biện pháp tu từ.'], 
        vd: ['Trình bày được bài học cách nghĩ, ứng xử từ văn bản.'] 
      }
    },
    writing: {
      textType: 'Kể lại một trải nghiệm đáng nhớ của bản thân',
      prompt: 'Viết bài văn kể lại trải nghiệm vui/đáng nhớ của em.',
      criteria: { 
        nb: ['Đảm bảo cấu trúc bài văn tự sự (MB, TB, KB).'], 
        th: ['Xác định đúng yêu cầu của đề, sử dụng đúng ngôi kể.'], 
        vd: ['Sắp xếp sự việc hợp lý, kể rõ diễn biến, ý nghĩa trải nghiệm.'], 
        vdc: ['Bố cục rõ ràng, lời văn giàu hình ảnh, cảm xúc, sáng tạo.'] 
      },
      rubric: [
        { criteria: 'a. Đảm bảo cấu trúc bài văn tự sự', points: 0.5 },
        { criteria: 'b. Xác định đúng yêu cầu của đề.', points: 0.5 },
        { criteria: 'c. Triển khai nội dung cốt truyện:\n- Mở bài: Giới thiệu được trải nghiệm đáng nhớ (0.5đ)\n- Thân bài: Kể chi tiết diễn biến câu chuyện (1.0đ)\n- Kết bài: Nêu cảm nghĩ, ý nghĩa của trải nghiệm (0.5đ)', points: 2.0 },
        { criteria: 'd. Chính tả, ngữ pháp', points: 0.5 },
        { criteria: 'e. Sáng tạo: Bố cục rõ ràng, cảm xúc', points: 0.5 }
      ]
    }
  });

  // --- THUẬT TOÁN TỰ ĐỘNG CÂN BẰNG ĐIỂM SỐ ĐỂ ĐẢM BẢO TỈ LỆ THEO YÊU CẦU ---
  const activeReadingScore = config.reading.totalScoreInput !== '' ? parseFloat(config.reading.totalScoreInput) : 6.0;
  const activeWritingScore = 10.0 - activeReadingScore;

  // Mục tiêu điểm của từng mức độ trên thang điểm 10
  const target_nb = (config.rates.nb || 40) / 100 * 10;
  const target_th = (config.rates.th || 30) / 100 * 10;
  const target_vd = (config.rates.vd || 30) / 100 * 10;

  // Tính điểm mặc định cho phần Viết (Phân bổ tỷ lệ cho phần viết theo tỷ lệ mục tiêu)
  // Trong cấu trúc thông thường, Viết sẽ chiếm điểm NB, TH, VD (VDC được gộp vào VD hoặc có thể chia đều)
  const w_nb = activeWritingScore * 0.25;
  const w_th = activeWritingScore * 0.25;
  const w_vd = activeWritingScore * 0.25;
  const w_vdc = activeWritingScore * 0.25;

  // Điểm MẶC ĐỊNH cân bằng bù trừ lại phần Đọc hiểu
  const def_r_nb = Math.max(0, target_nb - w_nb);
  const def_r_th = Math.max(0, target_th - w_th);
  const def_r_vd = Math.max(0, target_vd - w_vd - w_vdc); // Đọc hiểu phân mức Vận dụng tổng hợp

  // Điểm THỰC TẾ sử dụng (Nếu người dùng tự nhập thì lấy số người dùng nhập, nếu để trống thì lấy mặc định)
  const r_nb = config.reading.nb_scoreInput !== '' ? parseFloat(config.reading.nb_scoreInput) : def_r_nb;
  const r_th = config.reading.th_scoreInput !== '' ? parseFloat(config.reading.th_scoreInput) : def_r_th;
  const r_vd = config.reading.vd_scoreInput !== '' ? parseFloat(config.reading.vd_scoreInput) : def_r_vd;

  const actualReadingScore = r_nb + r_th + r_vd;
  const actualTotalScore = actualReadingScore + activeWritingScore;

  // Helper làm tròn hiển thị số và tính %
  const fmt = (num: any) => {
    const n = Number(num);
    if (isNaN(n)) return '0';
    return Number.isInteger(n) ? n.toFixed(1) : n.toFixed(2).replace(/\.00$/, '');
  };
  const pct = (val: number) => actualTotalScore > 0 ? fmt((val / actualTotalScore) * 100) : '0';

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'pl3' | 'dt') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    const reader = new FileReader();

    if (file.name.toLowerCase().endsWith('.docx')) {
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const result = await mammoth.extractRawText({ arrayBuffer });
          if (type === 'pl3') {
            setPl3FileText(result.value);
            setPl3FileName(file.name);
          }
          if (type === 'dt') {
            setDtFileText(result.value);
            setDtFileName(file.name);
          }
        } catch (err) {
          setErrorMsg('Lỗi khi đọc file .docx. Vui lòng copy/paste trực tiếp.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (file.name.toLowerCase().endsWith('.pdf')) {
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          let fullText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += pageText + '\n';
          }
          if (type === 'pl3') {
            setPl3FileText(fullText);
            setPl3FileName(file.name);
          }
          if (type === 'dt') {
            setDtFileText(fullText);
            setDtFileName(file.name);
          }
        } catch (err) {
          setErrorMsg('Lỗi khi đọc file .pdf. Vui lòng copy/paste trực tiếp.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (file.name.toLowerCase().endsWith('.txt') || file.name.toLowerCase().endsWith('.fdf')) {
      reader.onload = (event) => {
        if (type === 'pl3') {
          setPl3FileText(event.target?.result as string);
          setPl3FileName(file.name);
        }
        if (type === 'dt') {
          setDtFileText(event.target?.result as string);
          setDtFileName(file.name);
        }
      };
      reader.readAsText(file);
    } else {
      setErrorMsg('Vui lòng tải lên file .docx, .txt, .pdf hoặc .fdf. Đối với định dạng khác, hãy copy và dán vào ô dưới.');
    }
  };

  // Hàm gọi Gemini AI
  const analyzeWithAI = async () => {
    setHasAttemptedSubmit(true);
    const finalPl3Text = pl3Text.trim() ? pl3Text : pl3FileText;
    const finalDtText = dtText.trim() ? dtText : dtFileText;

    if (!finalPl3Text.trim()) {
      setErrorMsg('Vui lòng cung cấp nội dung Phụ lục 3 (Giới hạn chương trình).');
      setTimeout(() => {
        document.getElementById('pl3-input-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return;
    }
    setIsAnalyzing(true);
    setErrorMsg('');
    
    const r = config.reading;
    
    const hasMcq = r.mcq_multiple_choice_count > 0 || r.mcq_true_false_count > 0 || r.mcq_fill_blank_count > 0;
    const mcqInstruction = hasMcq 
      ? `TRONG ĐÓ CÓ TRẮC NGHIỆM: Phân bổ ${r.mcq_multiple_choice_count} câu Nhiều lựa chọn (với mảng options cho A, B, C, D), ${r.mcq_true_false_count} câu Đúng/Sai (tuân thủ nguyên tắc chọn đúng sai), và ${r.mcq_fill_blank_count} câu Điền khuyết. Còn lại là Tự luận trả lời ngắn.` 
      : '100% là câu hỏi Tự luận trả lời ngắn.';

    const systemPrompt = `Bạn là một chuyên gia khảo thí và giáo viên Ngữ văn kì cựu, am hiểu sâu sắc Chương trình GDPT 2018. Nhiệm vụ của bạn là tạo ra một bộ Đề kiểm tra Ngữ văn chuẩn mực, khoa học và linh hoạt theo từng đối tượng học sinh. Dựa vào Phụ lục 3 và Bảng đặc tả, hãy sinh ra 1 "Hồ sơ đề kiểm tra" hoàn chỉnh.
Yêu cầu cấu trúc RẤT NGHIÊM NGẶT và THỂ THỨC TRÌNH BÀY CHUẨN:
0. RÀ SOÁT VÀ XÁC ĐỊNH LỚP (BẮT BUỘC & QUAN TRỌNG NHẤT): Phân tích và rà soát NGHIÊM NGẶT nội dung Phụ lục 3 để xác định CHÍNH XÁC đề thi dành cho lớp mấy. NẾU PHỤ LỤC 3 LÀ CỦA LỚP 8 THÌ BẮT BUỘC PHẢI GHI LÀ LỚP 8, TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ Ý GHI LỚP 6. Tên lớp BẮT BUỘC phải đúng y như Phụ lục 3 cung cấp (chỉ ghi số, ví dụ: "6", "7", "8", "9"). TOÀN BỘ nội dung sinh ra (ngữ liệu, câu hỏi, yêu cầu viết) phải ĐÚNG, RÕ và KHỚP HOÀN TOÀN với chương trình của lớp đó.
1. MỤC TIÊU & THIẾT BỊ: Viết mục tiêu bài học gồm: 1. Về kiến thức, 2. Về năng lực (a. Năng lực chung, b. Năng lực đặc thù), 3. Phẩm chất. Thiết bị dạy học viết ngắn gọn.
2. ĐỌC HIỂU (${fmt(actualReadingScore)}đ): Tập trung kiểm tra khả năng tiếp nhận, phân tích và giải mã văn bản mới. Sáng tác/Tìm 1 ngữ liệu HOÀN TOÀN MỚI, KHÔNG CÓ TRONG SGK (văn học, nghị luận, hoặc thông tin). YÊU CẦU TỐI QUAN TRỌNG: NGỮ LIỆU PHẢI RẤT NGẮN GỌN, CHỈ TỪ 250 ĐẾN TỐI ĐA 400 CHỮ. NẾU VIẾT QUÁ DÀI HỆ THỐNG SẼ BỊ LỖI. Trình bày chia đoạn rõ ràng.
3. CHIẾN LƯỢC ĐẶT CÂU HỎI & CHIA ĐIỂM (ÁP DỤNG NGHIÊM NGẶT PHẦN ĐỌC HIỂU):
Tạo đúng CHÍNH XÁC ${r.nb_count + r.th_count + r.vd_count} câu theo phân bổ. ${mcqInstruction}
Quy tắc điểm số: Bắt buộc dùng các mốc chẵn (0.5 điểm hoặc 1.0 điểm). TUYỆT ĐỐI KHÔNG dùng 0.25, 0.75, 1.25, 1.5 trong phần Đọc hiểu. Trọng số điểm phải tỷ lệ thuận với mức độ tư duy. Đảm bảo tổng phần này là ${fmt(actualReadingScore)}đ.
   - Nhóm câu Nhận biết (${r.nb_count} câu - ${fmt(r_nb)}đ): Hỏi trực diện vào văn bản hoặc đặc trưng thể loại (Ngôi kể, nhân vật, thể thơ, chi tiết nổi bật). Không dùng các lệnh hỏi cũ sai tinh thần chương trình mới.
   - Nhóm câu Thông hiểu (${r.th_count} câu - ${fmt(r_th)}đ): Hỏi nguyên nhân, ý nghĩa chi tiết, tác dụng của biện pháp nghệ thuật/hình thức.
   - Nhóm câu Vận dụng (${r.vd_count} câu - ${fmt(r_vd)}đ): Kết nối thực tế, rút ra bài học. Câu hỏi phải rõ ràng, phạm vi hẹp để học sinh dễ liên hệ.
   YÊU CẦU VỀ CÁCH ĐẶT CÂU HỎI: Mức độ khó: "${config.difficulty}". Tuyệt đối KHÔNG bắt đầu nội dung câu hỏi bằng các cụm từ đếm số như "Câu 1:", "Câu 2:" hay ghi mức độ nhận thức vào nội dung câu hỏi (chẳng hạn KHÔNG ghi "(Nhận biết):"). CHỈ GHI TRỰC TIẾP NỘI DUNG CÂU HỎI. (Ví dụ: thay vì ghi "Câu 1 (Nhận biết): Chi tiết nào...", thì CHỈ GHI: "Chi tiết nào..."). Mỗi câu độc lập, tránh gây hiểu nhầm. KHÔNG lặp từ, suy diễn vòng vo. KHÔNG chia câu hỏi thành ý nhỏ (không có a, b, c...). MỖI CÂU HỎI PHẢI HOÀN TOÀN KHÁC NHAU. Kèm theo ĐÁP ÁN ngắn gọn, rõ điểm.
4. LÀM VĂN (${fmt(activeWritingScore)}đ): Yêu cầu học sinh tạo lập 1 bài văn hoàn chỉnh. Lệnh đề phải TƯỜNG MINH, chỉ đích danh vấn đề cốt lõi. Cấu trúc chuẩn: "Từ nội dung đoạn trích ở phần Đọc hiểu, em hãy viết một [Kiểu bài Viết] trình bày suy nghĩ của em về [Vấn đề CỤ THỂ rút ra từ văn bản]." Tuyệt đối không ra đề mở đánh đố kiểu: "Trình bày suy nghĩ về vấn đề được gợi ra từ văn bản trên".
HƯỚNG DẪN CHẤM LÀM VĂN: PHẢI CÓ Rubric tiêu chí cụ thể. Chia điểm rành mạch:
1. Đảm bảo cấu trúc bài văn, chính tả, sáng tạo (${fmt(activeWritingScore * 0.125)}đ).
2. Nội dung (${fmt(activeWritingScore * 0.875)}đ) BẮT BUỘC chia rành mạch thành:
  - Mở bài (${fmt(activeWritingScore * 0.125)}đ): Giới thiệu vấn đề.
  - Thân bài (${fmt(activeWritingScore * 0.6875)}đ): BẮT BUỘC CHIA NHỎ CÁC TIÊU CHÍ (ý nhỏ) ĐỂ CHẤM CHI TIẾT, hướng dẫn chấm rõ ràng từng phần để tránh trùng lặp. Áp dụng khung chia điểm sau (linh hoạt theo kiểu bài):
    + Dạng Tự sự: Hoàn cảnh; Diễn biến sự việc (kết hợp miêu tả, biểu cảm); Ý nghĩa sự việc đối với người kể.
    + Dạng Thuyết minh: Nguồn gốc/Khái quát; Đặc điểm cấu tạo/Quy trình; Bảo tồn/Phát huy.
    + Dạng So sánh văn học: Phân tích Đối tượng 1; Phân tích Đối tượng 2; Điểm tương đồng; Điểm khác biệt & Giải thích (đây là phần trọng tâm).
    + Dạng NL Nhận định: Giải thích nhận định; Chứng minh qua tác phẩm; Đánh giá, bình luận (đúng/sai, ý nghĩa).
    + Dạng NL Tích hợp (Vấn đề XH từ tác phẩm): Phần Văn học (tóm tắt chi tiết/ý nghĩa); Phần Xã hội (Giải thích & Chứng minh bằng thực tế); Đánh giá, mở rộng & Bài học.
  - Kết bài (${fmt(activeWritingScore * 0.0625)}đ): Tổng kết, khẳng định lại giá trị.
5. MỨC ĐỘ ĐÁNH GIÁ (BẢNG ĐẶC TẢ): Trích xuất RẤT NGẮN GỌN tiêu chí đánh giá tối đa 2 tiêu chí/mức, không quá 20 chữ.
6. TRẢ VỀ CHUẨN JSON THEO SCHEMA ĐỊNH SẴN. Đảm bảo đúng chính tả tiếng Việt 100%, hành văn mạch lạc. NGỮ LIỆU ĐỌC HIỂU PHẢI NGẮN GỌN (TỐI ĐA 300 CHỮ). BẠN PHẢI SINH RA MỘT CHUỖI JSON HOÀN CHỈNH TỪ ĐẦU ĐẾN CUỐI. CẮT BỚT CÁC CHI TIẾT DƯ THỪA ĐỂ KHÔNG BỊ TRÀN TOKEN.
LƯU Ý QUAN TRỌNG VỀ JSON:
1. TUYỆT ĐỐI KHÔNG SỬ DỤNG DẤU NHÁY KÉP (") BÊN TRONG CÁC CHUỖI VĂN BẢN, hãy thay bằng dấu nháy đơn (').
2. KHÔNG BAO GIỜ XUỐNG DÒNG BẰNG PHÍM ENTER TRONG CÁC CHUỖI VĂN BẢN (NẾU CẦN XUỐNG DÒNG HÃY GÕ KÝ TỰ \\n).
3. TRẢ VỀ DUY NHẤT ĐỊNH DẠNG JSON.`;

    const userPrompt = `Phụ lục 3:\n${finalPl3Text}\n\nĐặc tả (nếu có):\n${finalDtText}`;

    let parsed;
    let textResult = "";

    try {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const combinedSystemPrompt = systemPrompt + `
CHÚ TRỌNG: TRẢ VỀ DUY NHẤT CHUỖI JSON ĐÚNG CHUẨN, KHÔNG CÓ MARKDOWN HAY BẤT KỲ VĂN BẢN NÀO BÊN NGOÀI.
SỬ DỤNG CÚ PHÁP ĐỊNH DẠNG JSON SAU (TUYỆT ĐỐI KHÔNG DÙNG COMMENT TRONG JSON):
{
  "grade": "Ví dụ: '6', '7', '8', '9'",
  "objectives": {
    "knowledge": ["text"],
    "generalCompetence": ["text"],
    "specificCompetence": ["text"],
    "qualities": ["text"]
  },
  "materials": { "teacher": "text", "student": "text" },
  "readingTextType": "text",
  "readingPassage": ["text"],
  "readingSource": "text",
  "readingQuestions": [
    {
      "level": "nb/th/vd",
      "type": "mcq/tf/fib/essay",
      "options": ["A", "B"],
      "text": "Nội dung TRỰC TIẾP của câu hỏi. NGHIÊM CẤM THÊM TIỀN TỐ VÀ MỨC ĐỘ.",
      "points": 0.5,
      "answer": "text"
    }
  ],
  "readingCriteria": { "nb": ["Tiêu chí"], "th": ["Tiêu chí"], "vd": ["Tiêu chí"] },
  "writingTextType": "text",
  "writingPrompt": "text",
  "writingRubric": [ { "criteria": "text", "points": 0.5 } ],
  "writingCriteria": { "nb": ["text"], "th": ["text"], "vd": ["text"], "vdc": ["text"] }
}
ĐẢM BẢO KHÔNG BỊ TRÀN TOKEN (CẮT XÉN VĂN BẢN).`;

          const apiResponse = await fetch('/api/generate-exam', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userPrompt, systemPrompt: combinedSystemPrompt })
          });

          const responseData = await apiResponse.json();

          if (!apiResponse.ok) {
            throw new Error(responseData.error || 'Server error during generation');
          }

          if (!responseData.text) throw new Error("Kết quả văn bản từ AI bị rỗng.");
          
          textResult = responseData.text || "";
          
          // Lưu trữ thông tin mô hình và Context Caching
          setGenerationInfo({
            modelUsed: responseData.modelUsed,
            cacheUsed: responseData.cacheUsed,
            cacheId: responseData.cacheId,
            charCount: responseData.charCount,
            logs: responseData.logs
          });
          
          // Log model used and fallback logs for transparency
          console.log(`[AI] Thành công sử dụng model: ${responseData.modelUsed}`);
          if (responseData.cacheUsed) {
            console.log(`[AI Context Caching] Cache đã kích hoạt với ID: ${responseData.cacheId}`);
          }
          if (responseData.logs && responseData.logs.length > 0) {
            console.log("[AI Fallback Logs]:", responseData.logs.join('\n'));
          }
          
          // Trích xuất JSON an toàn hơn
          const jsonMatch = textResult.match(/\{[\s\S]*\}/);
          if (jsonMatch) textResult = jsonMatch[0];
          
          // Sửa lỗi xuống dòng trực tiếp hoặc tab trong chuỗi JSON
          textResult = textResult.replace(/"(?:[^"\\]|\\.)*"/g, (match) => {
            return match.replace(/\n/g, '\\n').replace(/\t/g, '\\t');
          });
          
          parsed = JSON.parse(textResult);
          break; // Thoát vòng lặp vì parse thành công
        } catch (attemptErr) {
          console.error(`Lần thử ${attempt} thất bại. Lỗi:`, attemptErr);
          if (attempt === 3) {
             throw new Error(`Sau 3 lần thử, dữ liệu sinh ra vẫn có lỗi. Lỗi cuối cùng: ${attemptErr instanceof Error ? attemptErr.message : String(attemptErr)}`);
          }
        }
      }

      setConfig(prev => ({
        ...prev,
        grade: parsed.grade || prev.grade,
        objectives: {
          knowledge: parsed.objectives?.knowledge || prev.objectives.knowledge,
          generalCompetence: parsed.objectives?.generalCompetence || prev.objectives.generalCompetence,
          specificCompetence: parsed.objectives?.specificCompetence || prev.objectives.specificCompetence,
          qualities: parsed.objectives?.qualities || prev.objectives.qualities,
        },
        materials: parsed.materials || prev.materials,
        reading: {
          ...prev.reading,
          textType: parsed.readingTextType || prev.reading.textType,
          passage: Array.isArray(parsed.readingPassage) ? parsed.readingPassage.join('\n\n') : (parsed.readingPassage || prev.reading.passage),
          source: parsed.readingSource || '',
          questions: parsed.readingQuestions || prev.reading.questions,
          criteria: parsed.readingCriteria || prev.reading.criteria
        },
        writing: {
          ...prev.writing,
          textType: parsed.writingTextType || prev.writing.textType,
          prompt: parsed.writingPrompt || prev.writing.prompt,
          rubric: parsed.writingRubric || prev.writing.rubric,
          criteria: parsed.writingCriteria || prev.writing.criteria
        }
      }));
      setHasGenerated(true);
      setActiveTab('fulldoc');
    } catch (err: any) {
      console.error("Lỗi khi gọi AI: ", err);
      setErrorMsg(err.message || 'Lỗi xử lý dữ liệu AI. Vui lòng thử lại sau.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePrint = () => {
    setActiveTab('fulldoc');
    setTimeout(() => window.print(), 300);
  };

  const handleExportWord = () => {
    const r = config.reading;
    const w = config.writing;
    
    const renderListHTML = (arr: any[]) => arr?.length > 0 ? arr.map(item => `<div style="margin-bottom: 4px;">- ${item}</div>`).join('') : '<div>- (Tự suy luận theo văn bản)</div>';

    const sortedQs = [...r.questions].sort((a,b) => {
      const order: Record<string, number> = { 'nb': 1, 'th': 2, 'vd': 3 };
      return (order[a.level?.toLowerCase() || ''] || 4) - (order[b.level?.toLowerCase() || ''] || 4);
    });

    const getQuestionNumbersHTML = (level: string) => {
      const indices: number[] = [];
      sortedQs.forEach((q, idx) => {
        if (q.level?.toLowerCase() === level) indices.push(idx + 1);
      });
      if (indices.length === 0) return '';
      return `<br/><span style="font-size: 10pt; font-weight: normal;">(Câu ${indices.join(', ')})</span>`;
    };

    const html = `<!DOCTYPE html>
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Ho_so_de_kiem_tra</title>
        <style>
          body { font-family: 'Times New Roman', Times, serif; font-size: 13pt; line-height: 1.5; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid black; padding: 8px; vertical-align: top; }
          .no-border { border: none; }
          .no-border th, .no-border td { border: none; padding: 0; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-justify { text-align: justify; }
          .font-bold { font-weight: bold; }
          .italic { font-style: italic; }
          .uppercase { text-transform: uppercase; }
          .page-break { page-break-before: always; }
          .bg-gray { background-color: #f3f4f6; }
          .text-red { color: #dc2626; }
          .text-blue { color: #1e40af; }
          .text-green { color: #15803d; }
        </style>
      </head>
      <body>
        <h2 class="font-bold uppercase">I. MỤC TIÊU</h2>
        <h3 class="font-bold">1. Về kiến thức</h3>
        ${config.objectives.knowledge.map(item => `<div>- ${item}</div>`).join('')}
        <h3 class="font-bold">2. Về năng lực</h3>
        <h4 class="font-bold italic" style="margin-left: 20px;">a. Năng lực chung</h4>
        ${config.objectives.generalCompetence.map(item => `<div style="margin-left: 20px;">- ${item}</div>`).join('')}
        <h4 class="font-bold italic" style="margin-left: 20px;">b. Năng lực đặc thù</h4>
        ${config.objectives.specificCompetence.map(item => `<div style="margin-left: 20px;">- ${item}</div>`).join('')}
        <h3 class="font-bold">3. Phẩm chất</h3>
        ${config.objectives.qualities.map(item => `<div>- ${item}</div>`).join('')}
        
        <br/>
        <h2 class="font-bold uppercase">II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU</h2>
        <div>1. Chuẩn bị của GV: ${config.materials.teacher}</div>
        <div>2. Chuẩn bị của HS: ${config.materials.student}</div>
        
        <br/>
        <h2 class="font-bold uppercase">III. TIẾN TRÌNH DẠY HỌC</h2>
        
        <h3 class="font-bold text-center uppercase">MA TRẬN ĐỀ KIỂM TRA ĐỊNH KÌ</h3>
        <div class="text-center italic" style="margin-bottom: 16px;">Môn: ${config.subject} ${config.grade} - Thời gian: ${config.duration}</div>
        
        <table>
          <thead>
            <tr class="bg-gray font-bold text-center">
              <th rowspan="2" style="width: 40px;">TT</th>
              <th rowspan="2">Kĩ năng</th>
              <th rowspan="2">Mức độ đánh giá</th>
              <th colspan="4">Số câu hỏi theo mức độ nhận thức</th>
              <th rowspan="2" style="width: 80px;">Tổng điểm</th>
              <th rowspan="2" style="width: 60px;">Tỉ lệ %</th>
            </tr>
            <tr class="bg-gray font-bold text-center">
              <th>Nhận biết</th>
              <th>Thông hiểu</th>
              <th>Vận dụng</th>
              <th>Vận dụng cao</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="text-center font-bold">1</td>
              <td class="font-bold text-center">Đọc hiểu</td>
              <td>${r.textType}</td>
              <td class="text-center">${r.nb_count} câu<br/><span style="font-size: 10pt;">(${fmt(r_nb)}đ)</span></td>
              <td class="text-center">${r.th_count} câu<br/><span style="font-size: 10pt;">(${fmt(r_th)}đ)</span></td>
              <td class="text-center">${r.vd_count} câu<br/><span style="font-size: 10pt;">(${fmt(r_vd)}đ)</span></td>
              <td class="text-center">-</td>
              <td class="text-center font-bold">${pct(actualReadingScore)}%</td>
            </tr>
            <tr>
              <td class="text-center font-bold">2</td>
              <td class="font-bold text-center">Viết</td>
              <td>${w.textType}</td>
              <td class="text-center">1*<br/><span style="font-size: 10pt;">(${fmt(w_nb)}đ)</span></td>
              <td class="text-center">1*<br/><span style="font-size: 10pt;">(${fmt(w_th)}đ)</span></td>
              <td class="text-center">1*<br/><span style="font-size: 10pt;">(${fmt(w_vd)}đ)</span></td>
              <td class="text-center">1*<br/><span style="font-size: 10pt;">(${fmt(w_vdc)}đ)</span></td>
              <td class="text-center font-bold">${pct(activeWritingScore)}%</td>
            </tr>
            <tr class="bg-gray font-bold">
              <td colspan="3" class="text-right">Tổng</td>
              <td class="text-center">${fmt(r_nb + w_nb)}đ</td>
              <td class="text-center">${fmt(r_th + w_th)}đ</td>
              <td class="text-center">${fmt(r_vd + w_vd)}đ</td>
              <td class="text-center">${fmt(w_vdc)}đ</td>
              <td class="text-center text-red">${fmt(actualTotalScore)}đ</td>
            </tr>
            <tr class="bg-gray font-bold">
              <td colspan="3" class="text-right">Tỉ lệ %</td>
              <td class="text-center">${pct(r_nb + w_nb)}%</td>
              <td class="text-center">${pct(r_th + w_th)}%</td>
              <td class="text-center">${pct(r_vd + w_vd)}%</td>
              <td class="text-center">${pct(w_vdc)}%</td>
              <td></td>
            </tr>
            <tr class="bg-gray font-bold">
              <td colspan="3" class="text-right">Tỉ lệ chung</td>
              <td colspan="2" class="text-center text-green">${pct(r_nb + w_nb + r_th + w_th)}%</td>
              <td colspan="2" class="text-center text-green">${pct(r_vd + w_vd + w_vdc)}%</td>
              <td></td>
            </tr>
          </tbody>
        </table>

        <div class="page-break"></div>
        <h3 class="font-bold text-center uppercase">BẢNG ĐẶC TẢ ĐỀ KIỂM TRA</h3>
        <table>
          <thead>
            <tr class="bg-gray font-bold text-center">
              <th rowspan="2" style="width: 40px;">TT</th>
              <th rowspan="2">Chương /<br/>Chủ đề</th>
              <th rowspan="2">Nội dung /<br/>Đơn vị kiến thức</th>
              <th rowspan="2" style="width: 33%;">Mức độ đánh giá</th>
              <th colspan="4">Số câu hỏi theo mức độ nhận thức</th>
            </tr>
            <tr class="bg-gray font-bold text-center">
              <th>Nhận biết</th>
              <th>Thông hiểu</th>
              <th>Vận dụng</th>
              <th>Vận dụng cao</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="text-center font-bold">1</td>
              <td class="font-bold text-center">Đọc hiểu</td>
              <td>${r.textType}</td>
              <td>
                <div style="margin-bottom: 8px;"><strong>Nhận biết:</strong><br/>${renderListHTML(r.criteria.nb)}</div>
                <div style="margin-bottom: 8px;"><strong>Thông hiểu:</strong><br/>${renderListHTML(r.criteria.th)}</div>
                <div><strong>Vận dụng:</strong><br/>${renderListHTML(r.criteria.vd)}</div>
              </td>
              <td class="text-center align-middle">${r.nb_count > 0 ? `${r.nb_count} câu${getQuestionNumbersHTML('nb')}` : ''}</td>
              <td class="text-center align-middle">${r.th_count > 0 ? `${r.th_count} câu${getQuestionNumbersHTML('th')}` : ''}</td>
              <td class="text-center align-middle">${r.vd_count > 0 ? `${r.vd_count} câu${getQuestionNumbersHTML('vd')}` : ''}</td>
              <td class="text-center align-middle"></td>
            </tr>
            <tr>
              <td class="text-center font-bold">2</td>
              <td class="font-bold text-center">Viết</td>
              <td>${w.textType}</td>
              <td>
                <div style="margin-bottom: 8px;"><strong>Nhận biết:</strong><br/>${renderListHTML(w.criteria.nb)}</div>
                <div style="margin-bottom: 8px;"><strong>Thông hiểu:</strong><br/>${renderListHTML(w.criteria.th)}</div>
                <div style="margin-bottom: 8px;"><strong>Vận dụng:</strong><br/>${renderListHTML(w.criteria.vd)}</div>
                <div><strong>Vận dụng cao:</strong><br/>${renderListHTML(w.criteria.vdc)}</div>
              </td>
              <td class="text-center align-middle"></td>
              <td class="text-center align-middle"></td>
              <td class="text-center align-middle"></td>
              <td class="text-center align-middle">1 câu*</td>
            </tr>
            <tr class="font-bold text-center">
              <td colspan="4">Tổng</td>
              <td>${r.nb_count > 0 ? `${r.nb_count} câu` : ''}</td>
              <td>${r.th_count > 0 ? `${r.th_count} câu` : ''}</td>
              <td>${r.vd_count > 0 ? `${r.vd_count} câu` : ''}</td>
              <td>1 câu</td>
            </tr>
            <tr class="font-bold text-center italic">
              <td colspan="4">Tỉ lệ %</td>
              <td>${pct(r_nb + w_nb)}</td>
              <td>${pct(r_th + w_th)}</td>
              <td>${pct(r_vd + w_vd)}</td>
              <td>${pct(w_vdc)}</td>
            </tr>
            <tr class="font-bold text-center italic">
              <td colspan="4">Tỉ lệ chung</td>
              <td colspan="2">${pct(r_nb + w_nb + r_th + w_th)}</td>
              <td colspan="2">${pct(r_vd + w_vd + w_vdc)}</td>
            </tr>
          </tbody>
        </table>

        <div class="page-break"></div>
        
        <table class="no-border" style="margin-bottom: 30px;">
          <tr>
            <td class="text-center" style="width: 50%;">
              <div class="font-bold uppercase">PHÒNG GD&ĐT .................</div>
              <div class="font-bold uppercase">TRƯỜNG THCS .................</div>
              <div class="font-bold">Tổ: Khoa học Xã hội</div>
              <div style="width: 100px; height: 1px; background-color: black; margin: 8px auto;"></div>
            </td>
            <td class="text-center" style="width: 50%;">
              <div class="font-bold uppercase" style="font-size: 14pt;">ĐỀ KIỂM TRA ${config.examType.toUpperCase()}</div>
              <div class="font-bold">Năm học: 20... - 20...</div>
              <div class="font-bold">Môn: ${config.subject} ${config.grade}</div>
              <div class="italic">Thời gian làm bài: ${config.duration}</div>
            </td>
          </tr>
        </table>

        <div class="font-bold uppercase" style="margin-bottom: 12px;">PHẦN I: ĐỌC HIỂU (${fmt(actualReadingScore)} điểm)</div>
        <div class="italic" style="margin-bottom: 12px;">Đọc kĩ đoạn trích sau và trả lời các câu hỏi bên dưới:</div>
        <div class="text-justify" style="white-space: pre-wrap; margin-bottom: 20px;">${r.passage}</div>
        ${r.source ? `<div class="text-right italic" style="margin-top: 8px;">(${r.source})</div>` : ''}
        
        <div style="margin-top: 20px;">
          ${sortedQs.map((q, idx) => {
            let optionsHtml = '';
            if (q.type === 'mcq' && q.options && q.options.length > 0) {
              const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
              optionsHtml = '<div style="margin-top: 4px; margin-left: 16px;">' + 
                q.options.map((opt, oIdx) => `<div style="margin-bottom: 2px;">${labels[oIdx] || '•'}. ${opt}</div>`).join('') +
              '</div>';
            }
            return `
            <div class="text-justify" style="margin-bottom: 12px;">
              <span class="font-bold">Câu ${idx + 1} (${fmt(q.points)} điểm): </span>
              <span style="white-space: pre-wrap;">${q.text}</span>
              ${optionsHtml}
            </div>
          `}).join('')}
        </div>

        <div class="font-bold uppercase" style="margin-top: 24px; margin-bottom: 12px;">PHẦN II: LÀM VĂN (${fmt(activeWritingScore)} điểm)</div>
        <div class="text-justify" style="white-space: pre-wrap;">${w.prompt}</div>

        <div class="page-break"></div>

        <table class="no-border" style="margin-bottom: 30px;">
          <tr>
            <td class="text-center" style="width: 50%;">
              <div class="font-bold uppercase">PHÒNG GD&ĐT .................</div>
              <div class="font-bold uppercase">TRƯỜNG THCS .................</div>
            </td>
            <td class="text-center" style="width: 50%;">
              <div class="font-bold uppercase" style="font-size: 14pt;">HƯỚNG DẪN CHẤM ĐỀ KIỂM TRA</div>
              <div class="font-bold">Môn: ${config.subject} ${config.grade}</div>
            </td>
          </tr>
        </table>

        <div class="font-bold" style="margin-bottom: 12px;">Phần I. Đọc – hiểu (${fmt(actualReadingScore)} điểm)</div>
        <div style="margin-bottom: 32px;">
          ${sortedQs.map((q, idx) => `
            <div class="text-justify" style="margin-bottom: 16px;">
              <span class="font-bold">Câu ${idx + 1}: </span>
              <span style="white-space: pre-wrap;">${q.answer} </span>
              <span class="italic font-bold text-red">(${fmt(q.points)} điểm)</span>
            </div>
          `).join('')}
        </div>

        <div class="font-bold" style="margin-bottom: 12px;">Phần II. Làm văn (${fmt(activeWritingScore)} điểm)</div>
        <table>
          <thead>
            <tr class="bg-gray font-bold text-center">
              <th>Tiêu chí</th>
              <th style="width: 80px;">Điểm</th>
            </tr>
          </thead>
          <tbody>
            ${w.rubric.map((item, idx) => `
              <tr>
                <td class="text-justify" style="white-space: pre-wrap;">${item.criteria}</td>
                <td class="text-center font-bold text-red">${item.points || fmt(activeWritingScore * (idx === 2 ? 0.5 : 0.125))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

      </body>
      </html>
    `;

    // @ts-ignore
    const blob = window.htmlDocx ? window.htmlDocx.asBlob(html) : new Blob(['\ufeff', html], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Ho_So_De_Kiem_Tra_${config.subject}_${config.grade}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- TAB 1: NHẬP LIỆU ---
  const InputTab = () => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-8"
    >
      {errorMsg && <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center border border-red-200 shadow-sm"><AlertCircle className="w-5 h-5 mr-2" /><p>{errorMsg}</p></div>}
      
      {/* Card 1: Thông tin chung */}
      <motion.div 
        whileHover={{ scale: 1.01, y: -4 }} 
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="bg-[rgba(255,255,255,0.98)] p-6 md:p-8 rounded-[24px] shadow-xl shadow-purple-500/10 border border-white/60 relative overflow-hidden"
      >
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center shadow-lg text-white font-bold text-xl">
            📝
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-800">1. Thông tin chung & Dữ liệu đầu vào</h2>
        </div>
        
        <div className="space-y-6">
          {/* Thông tin giáo viên */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-5 flex items-center gap-5 border border-blue-100 shadow-sm">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shrink-0 shadow-md">
              <User className="w-7 h-7 text-white" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-[18px] font-bold text-blue-900 mb-1">GV: Trần Thị Mơ</h3>
              <div className="flex items-center gap-2 text-blue-600">
                <Phone className="w-4 h-4" />
                <div className="flex items-center gap-4">
                  <span className="text-[14px]">Zalo / Facebook:</span>
                  <span className="text-[16px] font-medium">0989717861</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Chọn loại đề kiểm tra */}
            <div>
              <label className="block text-[15px] font-semibold text-[#2c3e50] mb-2">Chọn loại đề kiểm tra:</label>
              <select 
                value={config.examType}
                onChange={e => setConfig({...config, examType: e.target.value})}
                className="w-full border-2 border-gray-100 rounded-xl p-3 text-[15px] text-gray-700 focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none bg-white shadow-sm transition-all"
              >
                <option value="Giữa kì 1">Giữa kì 1</option>
                <option value="Cuối kì 1">Cuối kì 1</option>
                <option value="Giữa kì 2">Giữa kì 2</option>
                <option value="Cuối kì 2">Cuối kì 2</option>
              </select>
            </div>

            {/* Mức độ khó */}
            <div>
              <label className="block text-[15px] font-semibold text-[#2c3e50] mb-2">Mức độ khó (Đối tượng HS):</label>
              <select 
                value={config.difficulty}
                onChange={e => setConfig({...config, difficulty: e.target.value})}
                className="w-full border-2 border-gray-100 rounded-xl p-3 text-[15px] text-gray-700 focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none bg-white shadow-sm transition-all"
              >
                <option value="cơ bản">Cơ bản (Dành cho HS trung bình, yếu)</option>
                <option value="nâng cao">Nâng cao (Dành cho HS khá, giỏi)</option>
              </select>
            </div>

            {/* Thời gian làm bài */}
            <div>
              <label className="block text-[15px] font-semibold text-[#2c3e50] mb-2">Thời gian làm bài (phút):</label>
              <input 
                type="number" 
                value={config.duration.replace(' phút', '')} 
                onChange={e => setConfig({...config, duration: `${e.target.value} phút`})}
                className="w-full border-2 border-gray-100 rounded-xl p-3 text-[15px] text-gray-700 focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none bg-white shadow-sm transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tải lên Phụ lục 3 */}
            <div id="pl3-input-section" className={hasAttemptedSubmit && !(pl3Text.trim() || pl3FileText.trim()) ? "p-4 border-2 border-red-400 bg-red-50 rounded-2xl" : ""}>
              <label className="block text-[15px] font-semibold text-[#2c3e50] mb-2">
                Tải lên Phụ lục 3: <span className="text-red-500">*</span>
              </label>
              <div className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${pl3FileName ? 'border-emerald-400 bg-emerald-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}>
                <input type="file" accept=".docx,.txt,.pdf,.fdf" onChange={(e) => handleFileUpload(e, 'pl3')} className="hidden" id="upload-pl3" />
                <label htmlFor="upload-pl3" className="cursor-pointer flex flex-col items-center justify-center w-full h-full gap-2">
                  {pl3FileName ? (
                    <>
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center"><CheckCircle className="w-6 h-6 text-emerald-600" /></div>
                      <span className="text-[16px] font-semibold text-emerald-700">{pl3FileName}</span>
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center border border-gray-200"><Upload className="w-5 h-5 text-gray-500" /></div>
                      <span className="text-[15px] font-medium text-gray-600">Chọn file Phụ lục 3</span>
                    </>
                  )}
                </label>
              </div>
              {hasAttemptedSubmit && !(pl3Text.trim() || pl3FileText.trim()) && (
                <p className="text-red-500 text-sm mt-2 font-medium">⚠️ Vui lòng tải lên hoặc dán nội dung Phụ lục 3.</p>
              )}
            </div>

            {/* Tải lên Bảng đặc tả */}
            <div>
              <label className="block text-[15px] font-semibold text-[#2c3e50] mb-2">Tải lên Bảng đặc tả đánh giá mức độ:</label>
              <div className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${dtFileName ? 'border-emerald-400 bg-emerald-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}>
                <input type="file" accept=".docx,.txt,.pdf,.fdf" onChange={(e) => handleFileUpload(e, 'dt')} className="hidden" id="upload-dt" />
                <label htmlFor="upload-dt" className="cursor-pointer flex flex-col items-center justify-center w-full h-full gap-2">
                  {dtFileName ? (
                    <>
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center"><CheckCircle className="w-6 h-6 text-emerald-600" /></div>
                      <span className="text-[16px] font-semibold text-emerald-700">{dtFileName}</span>
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center border border-gray-200"><Upload className="w-5 h-5 text-gray-500" /></div>
                      <span className="text-[15px] font-medium text-gray-600">Chọn file Bảng đặc tả</span>
                    </>
                  )}
                </label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Nội dung văn bản Phụ lục 3 */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[14px] font-semibold text-gray-700">Chỉnh sửa Phụ lục 3 (nếu cần):</label>
              </div>
              <textarea 
                value={pl3Text} 
                onChange={e => setPl3Text(e.target.value)} 
                placeholder="Dán nội dung Phụ lục 3 hoặc chỉnh sửa nội dung đã tải lên tại đây..." 
                className="w-full h-[180px] border-2 border-gray-100 rounded-2xl p-4 text-[14px] text-gray-700 focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none bg-gray-50 font-mono resize-none transition-all" 
              />
            </div>

            {/* Nội dung văn bản Bảng đặc tả */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[14px] font-semibold text-gray-700">Chỉnh sửa Bảng đặc tả (nếu cần):</label>
              </div>
              <textarea 
                value={dtText} 
                onChange={e => setDtText(e.target.value)} 
                placeholder="Dán nội dung Bảng đặc tả hoặc chỉnh sửa nội dung đã tải lên tại đây..." 
                className="w-full h-[180px] border-2 border-gray-100 rounded-2xl p-4 text-[14px] text-gray-700 focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none bg-gray-50 font-mono resize-none transition-all" 
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Card 2: Cấu trúc đề */}
      <motion.div 
        whileHover={{ scale: 1.01, y: -4 }} 
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="bg-[rgba(255,255,255,0.98)] p-6 md:p-8 rounded-[24px] shadow-xl shadow-orange-500/10 border border-white/60 relative overflow-hidden"
      >
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#f97316] to-[#ec4899] flex items-center justify-center shadow-lg text-white font-bold text-xl">
            ⚙️
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-800">2. Tuỳ chỉnh Cơ cấu Đề thi</h2>
            <p className="text-sm text-gray-500 mt-1">Bỏ trống các ô điểm nếu muốn sử dụng tỉ lệ phần trăm bạn vừa nhập.</p>
          </div>
        </div>
        
        {/* Tỉ lệ điểm */}
        <div className="mb-8 p-6 bg-gradient-to-r from-orange-50 to-pink-50 rounded-2xl border border-orange-100">
          <label className="block text-base font-bold text-orange-900 mb-4">Tỉ lệ điểm (Biết - Hiểu - Vận dụng):</label>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[120px]">
              <label className="block text-sm font-semibold text-orange-800 mb-2">Biết (%)</label>
              <input 
                type="number" min="0" max="100"
                value={config.rates?.nb || ''} 
                onChange={e => setConfig({...config, rates: {...config.rates, nb: parseInt(e.target.value) || 0}})} 
                className="w-full border-2 border-white rounded-xl p-3 text-base focus:ring-2 focus:ring-orange-300 outline-none shadow-sm bg-white/80 backdrop-blur-sm" 
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-sm font-semibold text-orange-800 mb-2">Hiểu (%)</label>
              <input 
                type="number" min="0" max="100"
                value={config.rates?.th || ''} 
                onChange={e => setConfig({...config, rates: {...config.rates, th: parseInt(e.target.value) || 0}})} 
                className="w-full border-2 border-white rounded-xl p-3 text-base focus:ring-2 focus:ring-orange-300 outline-none shadow-sm bg-white/80 backdrop-blur-sm" 
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-sm font-semibold text-orange-800 mb-2">Vận dụng (%)</label>
              <input 
                type="number" min="0" max="100"
                value={config.rates?.vd || ''} 
                onChange={e => setConfig({...config, rates: {...config.rates, vd: parseInt(e.target.value) || 0}})} 
                className="w-full border-2 border-white rounded-xl p-3 text-base focus:ring-2 focus:ring-orange-300 outline-none shadow-sm bg-white/80 backdrop-blur-sm" 
              />
            </div>
          </div>
        </div>

        {/* Nhập tổng điểm đọc hiểu */}
        <div className="mb-8 p-6 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100">
          <label className="block text-base font-bold text-emerald-900 mb-3">Tổng điểm phần Đọc hiểu (Mặc định: 6.0)</label>
          <div className="flex items-center gap-3">
            <input 
              type="number" step="0.5" min="1" max="9"
              placeholder="VD: 5.0, 7.0"
              value={config.reading.totalScoreInput} 
              onChange={e => setConfig({...config, reading: {...config.reading, totalScoreInput: e.target.value}})} 
              className="w-32 border-2 border-white rounded-xl p-3 text-base focus:ring-2 focus:ring-emerald-300 outline-none shadow-sm bg-white/80 backdrop-blur-sm" 
            />
            <span className="text-base font-bold text-emerald-700">/ 10 điểm</span>
          </div>
          <div className="mt-3 inline-flex items-center px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm font-semibold">
            ✨ Hệ thống gán điểm phần Viết là {fmt(activeWritingScore)}đ
          </div>
        </div>

        {/* Nhập số câu hỏi và điểm từng phần */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          
          <div className="bg-gray-50/50 p-5 rounded-2xl border border-gray-100 shadow-sm">
            <label className="block text-[15px] font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">Nhận biết</label>
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-gray-600">Điểm phần này (đ):</span>
                <input type="number" step="0.25" min="0" placeholder={`Gợi ý: ${fmt(def_r_nb)}`} value={config.reading.nb_scoreInput} onChange={e => setConfig({...config, reading: {...config.reading, nb_scoreInput: e.target.value}})} className="w-full border-2 border-white rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-200 outline-none shadow-sm bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-gray-600">Số câu hỏi:</span>
                <input type="number" min="0" value={config.reading.nb_count} onChange={e => setConfig({...config, reading: {...config.reading, nb_count: Math.max(0, parseInt(e.target.value) || 0)}})} className="w-full border-2 border-white rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-200 outline-none shadow-sm bg-white" />
              </div>
            </div>
          </div>

          <div className="bg-gray-50/50 p-5 rounded-2xl border border-gray-100 shadow-sm">
            <label className="block text-[15px] font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">Thông hiểu</label>
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-gray-600">Điểm phần này (đ):</span>
                <input type="number" step="0.25" min="0" placeholder={`Gợi ý: ${fmt(def_r_th)}`} value={config.reading.th_scoreInput} onChange={e => setConfig({...config, reading: {...config.reading, th_scoreInput: e.target.value}})} className="w-full border-2 border-white rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-200 outline-none shadow-sm bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-gray-600">Số câu hỏi:</span>
                <input type="number" min="0" value={config.reading.th_count} onChange={e => setConfig({...config, reading: {...config.reading, th_count: Math.max(0, parseInt(e.target.value) || 0)}})} className="w-full border-2 border-white rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-200 outline-none shadow-sm bg-white" />
              </div>
            </div>
          </div>

          <div className="bg-gray-50/50 p-5 rounded-2xl border border-gray-100 shadow-sm">
            <label className="block text-[15px] font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">Vận dụng</label>
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-gray-600">Điểm phần này (đ):</span>
                <input type="number" step="0.25" min="0" placeholder={`Gợi ý: ${fmt(def_r_vd)}`} value={config.reading.vd_scoreInput} onChange={e => setConfig({...config, reading: {...config.reading, vd_scoreInput: e.target.value}})} className="w-full border-2 border-white rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-200 outline-none shadow-sm bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-gray-600">Số câu hỏi:</span>
                <input type="number" min="0" value={config.reading.vd_count} onChange={e => setConfig({...config, reading: {...config.reading, vd_count: Math.max(0, parseInt(e.target.value) || 0)}})} className="w-full border-2 border-white rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-200 outline-none shadow-sm bg-white" />
              </div>
            </div>
          </div>

        </div>

        {/* Cấu hình trắc nghiệm */}
        <div className="pt-6 border-t border-gray-200">
          <label className="block text-base font-bold text-gray-800 mb-4 flex items-center gap-2">🕹️ Cấu trúc Trắc nghiệm (Nhập 0 nếu thi Tự luận hoàn toàn)</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-4 rounded-xl border-2 border-gray-100 shadow-sm flex justify-between items-center">
              <span className="font-semibold text-gray-700">Nhiều lựa chọn:</span>
              <input type="number" min="0" value={config.reading.mcq_multiple_choice_count} onChange={e => setConfig({...config, reading: {...config.reading, mcq_multiple_choice_count: Math.max(0, parseInt(e.target.value) || 0)}})} className="w-16 border-b-2 border-gray-200 p-1 text-center font-bold outline-none focus:border-blue-500" />
            </div>
            <div className="bg-white p-4 rounded-xl border-2 border-gray-100 shadow-sm flex justify-between items-center">
              <span className="font-semibold text-gray-700">Đúng / Sai:</span>
              <input type="number" min="0" value={config.reading.mcq_true_false_count} onChange={e => setConfig({...config, reading: {...config.reading, mcq_true_false_count: Math.max(0, parseInt(e.target.value) || 0)}})} className="w-16 border-b-2 border-gray-200 p-1 text-center font-bold outline-none focus:border-blue-500" />
            </div>
            <div className="bg-white p-4 rounded-xl border-2 border-gray-100 shadow-sm flex justify-between items-center">
              <span className="font-semibold text-gray-700">Điền khuyết:</span>
              <input type="number" min="0" value={config.reading.mcq_fill_blank_count} onChange={e => setConfig({...config, reading: {...config.reading, mcq_fill_blank_count: Math.max(0, parseInt(e.target.value) || 0)}})} className="w-16 border-b-2 border-gray-200 p-1 text-center font-bold outline-none focus:border-blue-500" />
            </div>
          </div>
        </div>
      </motion.div>

      <div className="flex justify-center pt-4 pb-8">
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={analyzeWithAI} 
          disabled={isAnalyzing} 
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-70 text-white px-10 py-4 rounded-full font-bold text-lg transition-shadow flex items-center shadow-xl shadow-blue-500/30"
        >
          {isAnalyzing ? <><Loader2 className="w-6 h-6 mr-3 animate-spin" /> Đang xử lý AI...</> : <>✨ Khởi tạo Đề thi ngay</>}
        </motion.button>
      </div>
    </motion.div>
  );

  // --- FULL EXPORT COMPONENT (HỒ SƠ ĐẦY ĐỦ) ---
  const FullExportTab = () => {
    const r = config.reading;
    const w = config.writing;

    // Helper render list
    const renderList = (arr: any[]) => arr?.length > 0 ? arr.map((item, idx) => <span key={idx} className="block mb-1">- {item}</span>) : <span>- (Tự suy luận theo văn bản)</span>;
    
    // Sort questions to ensure order (NB -> TH -> VD)
    const sortedQs = [...r.questions].sort((a,b) => {
      const order: Record<string, number> = { 'nb': 1, 'th': 2, 'vd': 3 };
      return (order[a.level?.toLowerCase() || ''] || 4) - (order[b.level?.toLowerCase() || ''] || 4);
    });

    const getQuestionNumbersReact = (level: string) => {
      const indices: number[] = [];
      sortedQs.forEach((q, idx) => {
        if (q.level?.toLowerCase() === level) indices.push(idx + 1);
      });
      if (indices.length === 0) return null;
      return <><br/><span className="text-[10pt] font-normal">(Câu {indices.join(', ')})</span></>;
    };

    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white p-8 md:p-12 rounded-[24px] shadow-2xl border border-gray-100 print-container text-gray-900 leading-relaxed text-[13pt] overflow-hidden" 
        style={{ fontFamily: "'Times New Roman', Times, serif" }}
      >
        
        {/* I. MỤC TIÊU */}
        <div className="mb-6">
          <h2 className="font-bold text-lg uppercase mb-2">I. MỤC TIÊU</h2>
          <h3 className="font-bold ml-4">1. Về kiến thức</h3>
          <ul className="list-none ml-8 mb-2">
            {config.objectives.knowledge.map((item, i) => <li key={i}>- {item}</li>)}
          </ul>
          <h3 className="font-bold ml-4">2. Về năng lực</h3>
          <h4 className="font-bold italic ml-8">a. Năng lực chung</h4>
          <ul className="list-none ml-12 mb-2">
            {config.objectives.generalCompetence.map((item, i) => <li key={i}>- {item}</li>)}
          </ul>
          <h4 className="font-bold italic ml-8">b. Năng lực đặc thù</h4>
          <ul className="list-none ml-12 mb-2">
            {config.objectives.specificCompetence.map((item, i) => <li key={i}>- {item}</li>)}
          </ul>
          <h3 className="font-bold ml-4">3. Phẩm chất</h3>
          <ul className="list-none ml-8">
            {config.objectives.qualities.map((item, i) => <li key={i}>- {item}</li>)}
          </ul>
        </div>

        {/* II. THIẾT BỊ */}
        <div className="mb-8">
          <h2 className="font-bold text-lg uppercase mb-2">II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU</h2>
          <p className="ml-4">1. Chuẩn bị của GV: {config.materials.teacher}</p>
          <p className="ml-4">2. Chuẩn bị của HS: {config.materials.student}</p>
        </div>

        {/* III. TIẾN TRÌNH */}
        <div>
          <h2 className="font-bold text-lg uppercase mb-4">III. TIẾN TRÌNH DẠY HỌC</h2>
          
          {/* MA TRẬN */}
          <h3 className="font-bold text-center uppercase mb-2">MA TRẬN ĐỀ KIỂM TRA ĐỊNH KÌ</h3>
          <p className="text-center italic mb-4">Môn: {config.subject} {config.grade} - Thời gian: {config.duration}</p>
          <table className="w-full border-collapse border border-black text-center mb-8">
            <thead>
              <tr className="bg-gray-100 font-bold">
                <th rowSpan={2} className="border border-black p-2 w-10">TT</th>
                <th rowSpan={2} className="border border-black p-2">Kĩ năng</th>
                <th rowSpan={2} className="border border-black p-2">Nội dung</th>
                <th colSpan={4} className="border border-black p-2">Mức độ nhận thức</th>
                <th rowSpan={2} className="border border-black p-2 w-16">% điểm</th>
              </tr>
              <tr className="bg-gray-100 font-bold">
                <th className="border border-black p-2">Nhận biết</th>
                <th className="border border-black p-2">Thông hiểu</th>
                <th className="border border-black p-2">Vận dụng</th>
                <th className="border border-black p-2">VD cao</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black p-2 font-bold">1</td>
                <td className="border border-black p-2 font-bold">Đọc hiểu</td>
                <td className="border border-black p-2 text-left">{r.textType}</td>
                <td className="border border-black p-2">{r.nb_count} câu<br/><span className="text-xs">({fmt(r_nb)}đ)</span></td>
                <td className="border border-black p-2">{r.th_count} câu<br/><span className="text-xs">({fmt(r_th)}đ)</span></td>
                <td className="border border-black p-2">{r.vd_count} câu<br/><span className="text-xs">({fmt(r_vd)}đ)</span></td>
                <td className="border border-black p-2">-</td>
                <td className="border border-black p-2 font-bold">{pct(actualReadingScore)}%</td>
              </tr>
              <tr>
                <td className="border border-black p-2 font-bold">2</td>
                <td className="border border-black p-2 font-bold">Viết</td>
                <td className="border border-black p-2 text-left">{w.textType}</td>
                <td className="border border-black p-2">1*<br/><span className="text-xs">({fmt(w_nb)}đ)</span></td>
                <td className="border border-black p-2">1*<br/><span className="text-xs">({fmt(w_th)}đ)</span></td>
                <td className="border border-black p-2">1*<br/><span className="text-xs">({fmt(w_vd)}đ)</span></td>
                <td className="border border-black p-2">1*<br/><span className="text-xs">({fmt(w_vdc)}đ)</span></td>
                <td className="border border-black p-2 font-bold">{pct(activeWritingScore)}%</td>
              </tr>
              <tr className="bg-gray-50 font-bold">
                <td colSpan={3} className="border border-black p-2 text-right">Tổng</td>
                <td className="border border-black p-2">{fmt(r_nb + w_nb)}đ</td>
                <td className="border border-black p-2">{fmt(r_th + w_th)}đ</td>
                <td className="border border-black p-2">{fmt(r_vd + w_vd)}đ</td>
                <td className="border border-black p-2">{fmt(w_vdc)}đ</td>
                <td className="border border-black p-2 text-red-600">{fmt(actualTotalScore)}đ</td>
              </tr>
              <tr className="bg-gray-50 font-bold">
                <td colSpan={3} className="border border-black p-2 text-right">Tỉ lệ %</td>
                <td className="border border-black p-2">{pct(r_nb + w_nb)}%</td>
                <td className="border border-black p-2">{pct(r_th + w_th)}%</td>
                <td className="border border-black p-2">{pct(r_vd + w_vd)}%</td>
                <td className="border border-black p-2">{pct(w_vdc)}%</td>
                <td className="border border-black p-2"></td>
              </tr>
              <tr className="bg-gray-100 font-bold">
                <td colSpan={3} className="border border-black p-2 text-right">Tỉ lệ chung</td>
                <td colSpan={2} className="border border-black p-2 text-green-700">{pct(r_nb + w_nb + r_th + w_th)}%</td>
                <td colSpan={2} className="border border-black p-2 text-green-700">{pct(r_vd + w_vd + w_vdc)}%</td>
                <td className="border border-black p-2"></td>
              </tr>
            </tbody>
          </table>

          {/* ĐẶC TẢ */}
          <h3 className="font-bold text-center uppercase mb-2 page-break-before">BẢNG ĐẶC TẢ ĐỀ KIỂM TRA</h3>
          <table className="w-full border-collapse border border-black mb-10">
            <thead>
              <tr className="bg-gray-100 font-bold text-center">
                <th className="border border-black p-2 w-10" rowSpan={2}>TT</th>
                <th className="border border-black p-2" rowSpan={2}>Chương /<br/>Chủ đề</th>
                <th className="border border-black p-2" rowSpan={2}>Nội dung /<br/>Đơn vị kiến thức</th>
                <th className="border border-black p-2 w-1/3" rowSpan={2}>Mức độ đánh giá</th>
                <th className="border border-black p-2" colSpan={4}>Số câu hỏi theo mức độ nhận thức</th>
              </tr>
              <tr className="bg-gray-100 font-bold text-center">
                <th className="border border-black p-2">Nhận biết</th>
                <th className="border border-black p-2">Thông hiểu</th>
                <th className="border border-black p-2">Vận dụng</th>
                <th className="border border-black p-2">Vận dụng cao</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black p-2 text-center font-bold">1</td>
                <td className="border border-black p-2 font-bold text-center">Đọc hiểu</td>
                <td className="border border-black p-2">{r.textType}</td>
                <td className="border border-black p-2 align-top">
                  <div className="mb-2"><strong>Nhận biết:</strong> {renderList(r.criteria.nb)}</div>
                  <div className="mb-2"><strong>Thông hiểu:</strong> {renderList(r.criteria.th)}</div>
                  <div><strong>Vận dụng:</strong> {renderList(r.criteria.vd)}</div>
                </td>
                <td className="border border-black p-2 text-center align-middle">{r.nb_count > 0 ? <>{r.nb_count} câu{getQuestionNumbersReact('nb')}</> : ''}</td>
                <td className="border border-black p-2 text-center align-middle">{r.th_count > 0 ? <>{r.th_count} câu{getQuestionNumbersReact('th')}</> : ''}</td>
                <td className="border border-black p-2 text-center align-middle">{r.vd_count > 0 ? <>{r.vd_count} câu{getQuestionNumbersReact('vd')}</> : ''}</td>
                <td className="border border-black p-2 text-center align-middle"></td>
              </tr>
              <tr>
                <td className="border border-black p-2 text-center font-bold">2</td>
                <td className="border border-black p-2 font-bold text-center">Viết</td>
                <td className="border border-black p-2">{w.textType}</td>
                <td className="border border-black p-2 align-top">
                  <div className="mb-2"><strong>Nhận biết:</strong> {renderList(w.criteria.nb)}</div>
                  <div className="mb-2"><strong>Thông hiểu:</strong> {renderList(w.criteria.th)}</div>
                  <div className="mb-2"><strong>Vận dụng:</strong> {renderList(w.criteria.vd)}</div>
                  <div><strong>Vận dụng cao:</strong> {renderList(w.criteria.vdc)}</div>
                </td>
                <td className="border border-black p-2 text-center align-middle"></td>
                <td className="border border-black p-2 text-center align-middle"></td>
                <td className="border border-black p-2 text-center align-middle"></td>
                <td className="border border-black p-2 text-center align-middle">1 câu*</td>
              </tr>
              <tr className="font-bold text-center">
                <td className="border border-black p-2" colSpan={4}>Tổng</td>
                <td className="border border-black p-2">{r.nb_count > 0 ? `${r.nb_count} câu` : ''}</td>
                <td className="border border-black p-2">{r.th_count > 0 ? `${r.th_count} câu` : ''}</td>
                <td className="border border-black p-2">{r.vd_count > 0 ? `${r.vd_count} câu` : ''}</td>
                <td className="border border-black p-2">1 câu</td>
              </tr>
              <tr className="font-bold text-center italic">
                <td className="border border-black p-2" colSpan={4}>Tỉ lệ %</td>
                <td className="border border-black p-2">{pct(r_nb + w_nb)}</td>
                <td className="border border-black p-2">{pct(r_th + w_th)}</td>
                <td className="border border-black p-2">{pct(r_vd + w_vd)}</td>
                <td className="border border-black p-2">{pct(w_vdc)}</td>
              </tr>
              <tr className="font-bold text-center italic">
                <td className="border border-black p-2" colSpan={4}>Tỉ lệ chung</td>
                <td className="border border-black p-2" colSpan={2}>{pct(r_nb + w_nb + r_th + w_th)}</td>
                <td className="border border-black p-2" colSpan={2}>{pct(r_vd + w_vd + w_vdc)}</td>
              </tr>
            </tbody>
          </table>

          {/* ĐỀ KIỂM TRA */}
          <div className="page-break-before">
            <div className="flex justify-between items-start pb-4 mb-8">
              <div className="text-center w-1/2">
                <h3 className="font-bold uppercase text-[13pt]">PHÒNG GD&ĐT .................</h3>
                <h3 className="font-bold uppercase text-[13pt]">TRƯỜNG THCS .................</h3>
                <p className="font-bold text-[13pt]">Tổ: Khoa học Xã hội</p>
                <div className="w-32 h-[1px] bg-black mx-auto mt-2"></div>
              </div>
              <div className="text-center w-1/2">
                <h2 className="text-[14pt] font-bold uppercase">ĐỀ KIỂM TRA {config.examType.toUpperCase()}</h2>
                <p className="font-bold text-[13pt]">Năm học: 20... - 20...</p>
                <p className="font-bold text-[13pt]">Môn: {config.subject} {config.grade}</p>
                <p className="italic text-[13pt]">Thời gian làm bài: {config.duration}</p>
              </div>
            </div>

            <section className="mb-6">
              <h3 className="font-bold uppercase mb-3">PHẦN I: ĐỌC HIỂU ({fmt(actualReadingScore)} điểm)</h3>
              <p className="mb-3 italic">Đọc kĩ đoạn trích sau và trả lời các câu hỏi bên dưới:</p>
              <div className="text-justify mb-5 whitespace-pre-wrap leading-relaxed">
                {r.passage}
                {r.source && <span className="block text-right mt-3 italic">({r.source})</span>}
              </div>
              
              <div className="mt-5">
                {sortedQs.map((q, idx) => (
                  <div key={idx} className="mb-3 text-justify">
                    <span className="font-bold">Câu {idx + 1} ({fmt(q.points)} điểm): </span>
                    <span className="whitespace-pre-wrap">{q.text}</span>
                    {q.type === 'mcq' && q.options && q.options.length > 0 && (
                      <div className="mt-1 ml-4 space-y-1">
                        {q.options.map((opt, oIdx) => {
                          const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
                          return (
                            <div key={oIdx}>
                              <span className="font-medium mr-1">{labels[oIdx] || '•'}.</span> {opt}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="font-bold uppercase mb-3">PHẦN II: LÀM VĂN ({fmt(activeWritingScore)} điểm)</h3>
              <p className="whitespace-pre-wrap text-justify leading-relaxed">{w.prompt}</p>
            </section>
          </div>

          {/* HƯỚNG DẪN CHẤM */}
          <div className="page-break-before mt-12">
            <div className="flex justify-between items-start pb-4 mb-8">
              <div className="text-center w-1/2">
                <h3 className="font-bold uppercase text-[13pt]">PHÒNG GD&ĐT .................</h3>
                <h3 className="font-bold uppercase text-[13pt]">TRƯỜNG THCS .................</h3>
              </div>
              <div className="text-center w-1/2">
                <h2 className="text-[14pt] font-bold uppercase">HƯỚNG DẪN CHẤM ĐỀ KIỂM TRA</h2>
                <p className="font-bold text-[13pt]">Môn: {config.subject} {config.grade}</p>
              </div>
            </div>
            
            <h3 className="font-bold mb-3">Phần I. Đọc – hiểu ({fmt(actualReadingScore)} điểm)</h3>
            <div className="mb-8">
              {sortedQs.map((q, idx) => (
                <div key={`ans-${idx}`} className="mb-4 text-justify">
                  <span className="font-bold">Câu {idx + 1}: </span>
                  <span className="whitespace-pre-wrap">{q.answer} </span>
                  <span className="italic font-bold text-red-600">({fmt(q.points)} điểm)</span>
                </div>
              ))}
            </div>

            <h3 className="font-bold mb-3">Phần II. Làm văn ({fmt(activeWritingScore)} điểm)</h3>
            <table className="w-full border-collapse border border-black mb-6">
              <thead>
                <tr className="bg-gray-100 font-bold text-center">
                  <th className="border border-black p-2">Tiêu chí</th>
                  <th className="border border-black p-2 w-24">Điểm</th>
                </tr>
              </thead>
              <tbody>
                {w.rubric.map((item, idx) => (
                  <tr key={`rubric-${idx}`}>
                    <td className="border border-black p-3 whitespace-pre-wrap text-justify leading-relaxed">{item.criteria}</td>
                    <td className="border border-black p-3 text-center font-bold text-red-600">
                      {item.points || fmt(activeWritingScore * (idx === 2 ? 0.5 : 0.125))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen text-gray-800 font-sans p-4 md:p-8 relative" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 40%, #f093fb 100%)' }}>
      {/* Header */}
      <div className="max-w-6xl mx-auto print:hidden">
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div className="flex flex-col">
            <div className="flex items-end flex-wrap gap-2">
              <a href="https://giaoviendoimoi.com/" target="_blank" rel="noopener noreferrer" className="flex items-center group">
                <img src="https://res.cloudinary.com/dcgxb69v9/image/upload/v1782295167/Logo_bbjyh2.png" alt="Logo" className="h-8 md:h-10 object-contain mr-3 group-hover:scale-105 transition-transform" />
                <h1 className="text-xl md:text-3xl font-bold text-white flex items-center leading-none" style={{ height: '100%' }}>
                  Tạo đề thi chuẩn của môn Ngữ văn
                </h1>
              </a>
              <span className="text-white/70 text-xs md:text-sm mb-1 italic">Một công cụ thuộc sở hữu của giaoviendoimoi.com</span>
            </div>
            <p className="text-white/90 mt-2 text-sm md:text-base">Hỗ trợ điền điểm tổng hợp & Tự động chia lại điểm giữ chuẩn Ma Trận 30-40-30</p>
          </div>
          <div className="flex space-x-3 shrink-0">
            <button onClick={handleExportWord} disabled={!hasGenerated} className={`px-5 py-2.5 rounded-2xl font-medium transition flex items-center shadow-md ${!hasGenerated ? 'bg-white/20 text-white/50 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-400 to-blue-500 hover:from-emerald-500 hover:to-blue-600 text-white shadow-lg shadow-blue-500/30'}`}>
              <Download className="w-5 h-5 mr-2" /> Xuất File Word
            </button>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="flex bg-[rgba(255,255,255,0.98)] rounded-2xl shadow-xl overflow-hidden mb-6 p-1 gap-1">
          <button onClick={() => setActiveTab('input')} className={`flex-1 py-3 px-4 font-semibold rounded-xl flex justify-center items-center transition-all ${activeTab === 'input' ? 'bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}>
            <Upload className="w-5 h-5 mr-2" /> Tải Dữ Liệu Lên
          </button>
          <button 
            onClick={() => hasGenerated && setActiveTab('fulldoc')} 
            disabled={!hasGenerated}
            className={`flex-1 py-3 px-4 font-semibold rounded-xl flex justify-center items-center transition-all ${!hasGenerated ? 'opacity-50 cursor-not-allowed bg-transparent text-gray-400' : activeTab === 'fulldoc' ? 'bg-gradient-to-r from-[#764ba2] to-[#f093fb] text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            <FileText className="w-5 h-5 mr-2" /> Xem Toàn Bộ Hồ Sơ (Sản phẩm)
          </button>
        </div>

        {/* Trạng thái Mô hình & Tối ưu hóa Context Caching */}
        {hasGenerated && generationInfo && (
          <div className="mb-6 px-5 py-3 bg-[rgba(255,255,255,0.95)] backdrop-blur-md rounded-2xl shadow-lg border border-white/80 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-800">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-purple-800 flex items-center gap-1.5">
                ⚡ Mô hình phản hồi:
              </span>
              <span className="bg-purple-100 text-purple-900 font-mono text-xs px-2.5 py-1 rounded-lg font-semibold border border-purple-200">
                {generationInfo.modelUsed}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-indigo-800">Context Caching:</span>
              {generationInfo.cacheUsed ? (
                <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-lg font-semibold border border-emerald-200 flex items-center gap-1">
                  ✨ Đã tối ưu hóa Cache ({generationInfo.charCount ? `${generationInfo.charCount.toLocaleString()} ký tự` : '> 110.000 ký tự'})
                </span>
              ) : (
                <span className="bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-lg font-medium border border-gray-200">
                  Nhắc trực tiếp tiêu chuẩn {generationInfo.charCount ? `(${generationInfo.charCount.toLocaleString()} ký tự)` : ''}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <main className="max-w-6xl mx-auto">
        {activeTab === 'input' ? <InputTab /> : <FullExportTab />}
      </main>

      {/* Footer */}
      <footer className="mt-16 py-6 border-t border-white/20 text-center flex flex-col items-center justify-center space-y-2 print:hidden">
        <a href="https://giaoviendoimoi.com/" target="_blank" rel="noopener noreferrer" className="text-[rgba(255,255,255,0.85)] hover:text-white transition-colors text-lg font-medium">Cộng đồng Giáo viên đổi mới</a>
        <div className="flex gap-6 text-sm text-[rgba(255,255,255,0.85)]">
          <span>Hỗ trợ: Trần Thị Mơ</span>
          <span>SĐT/Zalo: 0989717861</span>
        </div>
      </footer>
      
      {/* CSS in để đảm bảo ngắt trang */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background: white; margin: 0; padding: 0; }
          .print\\:hidden { display: none !important; }
          .print-container { box-shadow: none !important; border: none !important; padding: 0 !important; width: 100%; max-width: 100%; }
          table { width: 100% !important; page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          .page-break-before { page-break-before: always; margin-top: 2rem; }
        }
      `}} />
    </div>
  );
}
