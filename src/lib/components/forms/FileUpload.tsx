import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface, border, text as textTokens, transition, radius } from '@/lib/design-system/tokens';
import { Upload } from 'lucide-react';

export interface FileUploadProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  accept?: string;
  multiple?: boolean;
  maxSize?: number;
  onChange?: (files: FileList | null) => void;
  label?: string;
  description?: string;
}

export const FileUpload = React.forwardRef<HTMLDivElement, FileUploadProps>(
  ({ className, accept, multiple, maxSize, onChange, label = 'Upload a file', description, ...props }, ref) => {
    const [isDragging, setIsDragging] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const handleDrag = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.type === 'dragenter' || e.type === 'dragover') setIsDragging(true);
      else if (e.type === 'dragleave') setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      onChange?.(e.dataTransfer.files);
    };

    return (
      <div
        ref={ref}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed cursor-pointer',
          radius.lg,
          transition.fast,
          isDragging
            ? 'border-blue-500 bg-blue-500/5'
            : `${border.default} ${surface.sunken} hover:border-zinc-600`,
          className,
        )}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        {...props}
      >
        <Upload className={cn('h-8 w-8 mb-3', isDragging ? 'text-blue-400' : textTokens.disabled)} />
        <p className={cn('text-sm font-medium', textTokens.secondary)}>{label}</p>
        <p className={cn('text-xs mt-1', textTokens.tertiary)}>
          {description || 'Drag and drop or click to browse'}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => onChange?.(e.target.files)}
          className="sr-only"
        />
      </div>
    );
  },
);
FileUpload.displayName = 'FileUpload';
