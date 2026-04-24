import React, { useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Download, Printer } from "lucide-react";
import { format } from "date-fns";

// クリニック情報を環境変数から取得（.env の VITE_CLINIC_* で設定）
const CLINIC = {
  name: import.meta.env.VITE_CLINIC_NAME || 'クリニック名',
  postal: import.meta.env.VITE_CLINIC_POSTAL || '',
  address: import.meta.env.VITE_CLINIC_ADDRESS || '',
  tel: import.meta.env.VITE_CLINIC_TEL || '',
  fax: import.meta.env.VITE_CLINIC_FAX || '',
  contact: import.meta.env.VITE_CLINIC_CONTACT || '事務局',
}

export default function PdfExportButton({ type, patient, record }) {
  const printRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!printRef.current) return;
    setIsExporting(true);

    try {
      const element = printRef.current;
      element.style.display = "block"; // 一時的に表示

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff"
      });

      element.style.display = "none"; // 再び非表示

      const imgData = canvas.toDataURL("image/jpeg", 1.0);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
      
      const fileName = `${type === "receipt" ? "領収書" : "FAX送付状"}_${patient?.name || "患者"}_${format(new Date(), "yyyyMMdd")}.pdf`;
      pdf.save(fileName);
      
    } catch (error) {
      console.error("PDF Export Error:", error);
      alert("PDFの生成に失敗しました");
    } finally {
      setIsExporting(false);
    }
  };

  const todayStr = format(new Date(), "yyyy年MM月dd日");
  const billingMonth = record?.yearMonth ? record.yearMonth.replace("-", "年") + "月" : "";

  return (
    <>
      <button
        onClick={handleExport}
        disabled={isExporting}
        className="inline-flex items-center px-3 py-1.5 border border-slate-300 shadow-sm text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
      >
        {type === "receipt" ? (
          <Printer className="mr-1.5 h-4 w-4 text-slate-500" />
        ) : (
          <Download className="mr-1.5 h-4 w-4 text-slate-500" />
        )}
        {type === "receipt" ? "領収書PDF" : "FAX送付状"}
      </button>

      {/* 隠しPDFテンプレート */}
      <div style={{ display: "none" }}>
        <div 
          ref={printRef} 
          className="bg-white text-black p-12 mx-auto"
          style={{ width: "210mm", minHeight: "297mm", boxSizing: "border-box", fontFamily: "sans-serif" }}
        >
          {type === "receipt" ? (
            // 領収書テンプレート
            <div className="border border-slate-800 p-8 h-full">
              <div className="flex justify-between items-start mb-12">
                <h1 className="text-3xl font-bold tracking-widest border-b-2 border-black pb-2">領収証</h1>
                <p className="text-sm">発行日: {todayStr}</p>
              </div>

              <div className="mb-10 text-xl flex items-end">
                <span className="font-bold text-2xl mr-4">{patient?.name}</span> 様
              </div>

              <div className="mb-12 border-b border-black flex justify-between items-end pb-2">
                <span className="text-lg">金額</span>
                <span className="text-3xl font-bold">¥ {record?.billingAmount?.toLocaleString() || 0} -</span>
              </div>

              <p className="mb-16 text-lg">
                但し、<span className="font-medium">{billingMonth}分 訪問歯科診療代</span> として上記正に領収いたしました。
              </p>

              <div className="flex justify-end mt-20">
                <div className="text-right">
                  <p className="text-lg font-bold mb-2">{CLINIC.name}</p>
                  {CLINIC.postal && <p className="text-sm mb-1">{CLINIC.postal}</p>}
                  {CLINIC.address && <p className="text-sm mb-1">{CLINIC.address}</p>}
                  {CLINIC.tel && <p className="text-sm mb-1">TEL: {CLINIC.tel}</p>}
                  <div className="mt-4 border border-black w-20 h-20 ml-auto flex items-center justify-center text-xs text-slate-400">
                    印
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // FAX送付状テンプレート
            <div className="h-full">
              <div className="text-center mb-12">
                <h1 className="text-3xl font-bold tracking-[0.3em] underline underline-offset-8">ＦＡＸ 送 付 状</h1>
              </div>

              <div className="flex justify-between mb-16">
                <div className="w-1/2 text-lg">
                  <p className="mb-4">
                    <span className="font-bold border-b border-black pb-1 px-4 text-xl">
                      {patient?.isFacility ? patient?.facilityName : "ご担当ケアマネージャー"} 御中
                    </span>
                  </p>
                </div>
                <div className="w-1/3 text-right text-sm space-y-2">
                  <p>送信日： {todayStr}</p>
                  <div className="mt-6">
                    <p className="font-bold text-base">{CLINIC.name}</p>
                    {CLINIC.postal && <p>{CLINIC.postal} {CLINIC.address}</p>}
                    {CLINIC.tel && <p>TEL: {CLINIC.tel}</p>}
                    {CLINIC.fax && <p>FAX: {CLINIC.fax}</p>}
                    <p>担当: {CLINIC.contact}</p>
                  </div>
                </div>
              </div>

              <div className="mb-10 text-lg border-l-4 border-black pl-4 py-2 bg-slate-50">
                <p>拝啓</p>
                <p className="mt-2 pl-4">
                  平素は格別のご高配を賜り、厚く御礼申し上げます。<br/>
                  下記の件につきまして、ご報告および書類の送付を申し上げます。<br/>
                  ご査収のほど、よろしくお願い申し上げます。
                </p>
                <p className="text-right mt-2">敬具</p>
              </div>

              <div className="text-center text-xl tracking-widest my-8">記</div>

              <table className="w-full border-collapse border border-black text-lg mb-8">
                <tbody>
                  <tr>
                    <td className="border border-black p-4 w-1/3 bg-slate-100 font-bold">対象患者様</td>
                    <td className="border border-black p-4">{patient?.name} 様</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-4 bg-slate-100 font-bold">対象月</td>
                    <td className="border border-black p-4">{billingMonth}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-4 bg-slate-100 font-bold">送信内容</td>
                    <td className="border border-black p-4">
                      □ 月次請求書<br/>
                      □ 訪問診療実施報告書<br/>
                      □ その他（　　　　　　　　）
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-black p-4 bg-slate-100 font-bold">通信欄</td>
                    <td className="border border-black p-4 h-32 align-top">
                      特記事項はありません。
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="text-center text-lg mt-12">
                以上
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
