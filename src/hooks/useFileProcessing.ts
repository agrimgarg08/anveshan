import { useState } from 'react';
import JSZip from 'jszip';
import { toast } from 'sonner';
import { QueueItem } from '@/types';

export function useFileProcessing() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'processing' | 'done'>('idle');
  const [activeViewIndex, setActiveViewIndex] = useState<number>(0);

  const processAddedFiles = async (files: FileList | File[]) => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const newItems: QueueItem[] = [];
    let extractedImages = 0;
    let failedZips = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const lowerName = file.name.toLowerCase();

      if (validTypes.includes(file.type) || lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
        newItems.push({
          id: Math.random().toString(36).substring(2, 9),
          file,
          previewUrl: URL.createObjectURL(file),
          status: 'pending'
        });
      } else if (lowerName.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed') {
        try {
          const zip = await JSZip.loadAsync(file);
          const zipEntries = Object.values(zip.files);
          for (const entry of zipEntries) {
            if (!entry.dir) {
              const entryNameLower = entry.name.toLowerCase();
              if (entryNameLower.endsWith('.png') || entryNameLower.endsWith('.jpg') || entryNameLower.endsWith('.jpeg')) {
                const blob = await entry.async('blob');
                const extractedFile = new File([blob], entry.name, { type: entryNameLower.endsWith('.png') ? 'image/png' : 'image/jpeg' });
                newItems.push({
                  id: Math.random().toString(36).substring(2, 9),
                  file: extractedFile,
                  previewUrl: URL.createObjectURL(extractedFile),
                  status: 'pending'
                });
                extractedImages++;
              }
            }
          }
        } catch {
          failedZips++;
        }
      }
    }

    if (extractedImages > 0) toast.success(`Extracted ${extractedImages} images from ZIP files.`);
    if (failedZips > 0) toast.error(`Failed to read ${failedZips} ZIP files.`);

    if (newItems.length === 0) {
      toast.error('No valid images (PNG/JPG) found.');
      return;
    }

    setQueue(prev => [...prev, ...newItems]);
    setProcessingStatus(prev => prev === 'done' ? 'idle' : prev);
  };

  const handleClear = () => {
    setQueue([]);
    setProcessingStatus('idle');
    setActiveViewIndex(0);
  };

  const handleRemoveQueueItem = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setQueue(prev => {
      const idx = prev.findIndex(item => item.id === id);
      if (idx === -1) return prev;
      
      const newQueue = prev.filter(item => item.id !== id);
      
      if (activeViewIndex === idx) {
        if (newQueue.length > 0) {
          setActiveViewIndex(Math.max(0, idx - 1));
        } else {
          setActiveViewIndex(0);
        }
      } else if (activeViewIndex > idx) {
        setActiveViewIndex(activeViewIndex - 1);
      }
      return newQueue;
    });
  };

  const startProcessing = async (retryErrors = false) => {
    if (queue.length === 0) return;

    setProcessingStatus('processing');

    const itemsToProcess = queue
      .map((item, idx) => ({ item, idx }))
      .filter(x => x.item.status === 'pending' || (retryErrors && x.item.status === 'error'));

    let hasErrors = false;

    for (const { item, idx } of itemsToProcess) {
      // Set to processing immediately to update UI
      setQueue(prev => {
        const next = [...prev];
        if (next[idx]) {
          next[idx] = { ...next[idx], status: 'processing' };
        }
        return next;
      });

      const formData = new FormData();
      formData.append('file', item.file);

      try {
        const res = await fetch('/api/process', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.detail || 'The processing API returned an error.');
        }

        const data = await res.json();

        setQueue(prev => {
          const next = [...prev];
          if (next[idx]) {
            next[idx] = { ...next[idx], status: 'done', data };
          }
          return next;
        });

      } catch (err: unknown) {
        hasErrors = true;
        setQueue(prev => {
          const next = [...prev];
          if (next[idx]) {
            next[idx] = { ...next[idx], status: 'error', error: err instanceof Error ? err.message : String(err) };
          }
          return next;
        });
      }
    }

    setProcessingStatus('done');
    if (hasErrors) {
      toast.error('Batch processing finished with some errors.');
    } else {
      toast.success('Batch processing complete!');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processAddedFiles(e.target.files);
    }
  };

  return {
    queue,
    processingStatus,
    activeViewIndex,
    setActiveViewIndex,
    processAddedFiles,
    handleClear,
    handleRemoveQueueItem,
    startProcessing,
    handleFileChange,
  };
}
