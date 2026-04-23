import { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Printer, Download } from 'lucide-react';

interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  addons?: { name: string; price: number; quantity: number }[];
}

interface ReceiptData {
  orderNumber: string;
  orderType: string;
  date: string;
  cashierName: string;
  branchName: string;
  items: ReceiptItem[];
  subtotal: number;
  discountAmount: number;
  discountType: string | null;
  vatAmount: number;
  serviceCharge: number;
  total: number;
  paymentMethod: string;
  customerName?: string;
  customerPhone?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: ReceiptData | null;
}

export function ReceiptDialog({ open, onOpenChange, receipt }: Props) {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!receipt) return null;

  const handlePrint = () => {
    const content = receiptRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank', 'width=300,height=600');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Receipt ${receipt.orderNumber}</title>
      <style>
        body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 10px; width: 280px; color: #000; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .line { border-top: 1px dashed #000; margin: 6px 0; }
        .row { display: flex; justify-content: space-between; }
        .small { font-size: 10px; }
      </style></head><body>
        ${content.innerHTML}
        <script>window.print(); window.close();</script>
      </body></html>
    `);
    printWindow.document.close();
  };

  const handleDownloadPDF = () => {
    handlePrint();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Receipt</DialogTitle>
        </DialogHeader>
        <div ref={receiptRef} className="bg-white text-black p-4 rounded-lg font-mono text-xs space-y-1">
          <div className="text-center">
            <p className="font-bold text-sm">SBJ Foods & Drinks</p>
            <p className="text-[10px]">{receipt.branchName}</p>
            <p className="text-[10px]">{receipt.date}</p>
          </div>
          <div className="border-t border-dashed border-gray-400 my-2" />
          <div className="flex justify-between">
            <span>Order: {receipt.orderNumber}</span>
            <span className="capitalize">{receipt.orderType.replace('_', ' ')}</span>
          </div>
          {receipt.customerName && <p>Customer: {receipt.customerName}</p>}
          <p>Cashier: {receipt.cashierName}</p>
          <div className="border-t border-dashed border-gray-400 my-2" />

          {receipt.items.map((item, i) => (
            <div key={i}>
              <div className="flex justify-between">
                <span>{item.quantity}x {item.name}</span>
                <span>₦{item.totalPrice.toLocaleString()}</span>
              </div>
              {item.addons?.map((a, j) => (
                <div key={j} className="flex justify-between pl-3 text-[10px] text-gray-600">
                  <span>+ {a.name}</span>
                  <span>₦{(a.price * a.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>
          ))}

          <div className="border-t border-dashed border-gray-400 my-2" />
          <div className="flex justify-between"><span>Subtotal</span><span>₦{receipt.subtotal.toLocaleString()}</span></div>
          {receipt.discountAmount > 0 && (
            <div className="flex justify-between text-green-700">
              <span>Discount {receipt.discountType === 'percentage' ? '(%)' : ''}</span>
              <span>-₦{receipt.discountAmount.toLocaleString()}</span>
            </div>
          )}
          {receipt.vatAmount > 0 && (
            <div className="flex justify-between"><span>VAT (7.5%)</span><span>₦{receipt.vatAmount.toLocaleString()}</span></div>
          )}
          {receipt.serviceCharge > 0 && (
            <div className="flex justify-between"><span>Service Charge</span><span>₦{receipt.serviceCharge.toLocaleString()}</span></div>
          )}
          <div className="border-t border-dashed border-gray-400 my-2" />
          <div className="flex justify-between font-bold text-sm">
            <span>TOTAL</span><span>₦{receipt.total.toLocaleString()}</span>
          </div>
          <p>Paid by: {receipt.paymentMethod}</p>
          <div className="border-t border-dashed border-gray-400 my-2" />
          <p className="text-center text-[10px]">Thank you for dining with us!</p>
          <p className="text-center text-[10px]">SBJ Foods & Drinks</p>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
          <Button className="flex-1" onClick={handleDownloadPDF}>
            <Download className="h-4 w-4 mr-1" /> Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
