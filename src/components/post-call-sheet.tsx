'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCall } from '@/contexts/call-context';
import type { Call } from '@/lib/types';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { generateSummaryAction } from '@/lib/actions';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wand2 } from 'lucide-react';

const notesFormSchema = z.object({
  notes: z.string().min(1, 'Notes cannot be empty.'),
  summary: z.string().optional(),
});

type NotesFormValues = z.infer<typeof notesFormSchema>;

export default function PostCallSheet({ call }: { call: Call }) {
  const { dispatch, updateNotesAndSummary } = useCall();
  const { toast } = useToast();
  const [isSummarizing, setIsSummarizing] = useState(false);

  const form = useForm<NotesFormValues>({
    resolver: zodResolver(notesFormSchema),
    defaultValues: {
      notes: call.notes || '',
      summary: call.summary || '',
    },
  });

  useEffect(() => {
    form.reset({
        notes: call.notes || '',
        summary: call.summary || '',
    })
  }, [call, form]);

  const handleOpenChange = (open: boolean) => {
    if (!open && dispatch) {
      dispatch({ type: 'CLOSE_POST_CALL_SHEET' });
    }
  };
  
  const handleGenerateSummary = async () => {
    const notes = form.getValues('notes');
    if (!notes) {
        form.setError('notes', { message: 'Please enter notes before generating a summary.' });
        return;
    }
    setIsSummarizing(true);
    const result = await generateSummaryAction(notes);
    if (result.summary) {
        form.setValue('summary', result.summary);
        toast({ title: 'Summary Generated', description: 'AI summary has been successfully created.' });
    } else {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: result.error || 'Could not generate summary.'
        });
    }
    setIsSummarizing(false);
  }

  const onSubmit = (data: NotesFormValues) => {
    if (updateNotesAndSummary) {
        const phoneNumber = call.direction === 'outgoing' ? call.to : call.from;
        updateNotesAndSummary(call.id, data.notes, data.summary, call.leadId, phoneNumber);
    }
    if (dispatch) {
        dispatch({ type: 'CLOSE_POST_CALL_SHEET' });
    }
  };

  return (
    <Sheet open={!!call} onOpenChange={handleOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col h-full"
          >
            <SheetHeader>
              <SheetTitle>Post-Call Notes</SheetTitle>
              <SheetDescription>
                Add notes and generate a summary for your call with{' '}
                {call.direction === 'incoming' ? call.from : call.to}.
              </SheetDescription>
            </SheetHeader>
            <div className="py-6 space-y-4 flex-1 overflow-y-auto">
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Call Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter your notes here..."
                        className="min-h-[120px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="summary"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between items-center">
                      <FormLabel>AI Summary</FormLabel>
                      <Button type="button" variant="outline" size="sm" onClick={handleGenerateSummary} disabled={isSummarizing}>
                        {isSummarizing ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Wand2 className="mr-2 h-4 w-4" />
                        )}
                        Generate
                      </Button>
                    </div>
                    <FormControl>
                      <Textarea
                        placeholder="AI-generated summary will appear here."
                        className="min-h-[120px] bg-muted/50"
                        readOnly={isSummarizing}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <SheetFooter>
              <Button type="submit">Save Notes</Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
