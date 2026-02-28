import CustomerTimesheetDetail from "@/app/customer/orders/[id]/timesheets/[timesheetId]/page";
import WipTradeBreakdown from "@/components/WipTradeBreakdown";

export default function InternalTimesheetDetailPage() {
  return (
    <>
      <CustomerTimesheetDetail />
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 40px 40px' }}>
        <WipTradeBreakdown />
      </div>
    </>
  );
}
