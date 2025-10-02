import CallHistoryTable from '@/components/call-history-table';
import { AppLogo } from '@/components/icons';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import Image from 'next/image';

export default function Home() {
  return (
    <div className="flex-1 space-y-4 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center space-x-4">
        <Image src="https://storage.googleapis.com/aifire.appspot.com/project-assets/bigfoot-logo.png" alt="Caprae Capital Partners Logo" width={40} height={40} />
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">
            Caprae Capital Partners
          </h1>
          <p className="text-sm text-muted-foreground">
            Your AI-powered softphone for enhanced productivity.
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
