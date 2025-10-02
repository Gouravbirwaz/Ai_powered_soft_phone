import CallHistoryTable from '@/components/call-history-table';
import { AppLogo } from '@/components/icons';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function Home() {
  return (
    <div className="flex-1 space-y-4 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center space-x-4">
        <AppLogo className="h-10 w-10 text-primary" />
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">
            Caprae Capital Partners
          </h1>
          <p className="text-sm text-muted-foreground">
            Your recent call activity.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Call History</CardTitle>
          <CardDescription>
            A log of all your recent incoming and outgoing calls.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CallHistoryTable />
        </CardContent>
      </Card>
    </div>
  );
}
