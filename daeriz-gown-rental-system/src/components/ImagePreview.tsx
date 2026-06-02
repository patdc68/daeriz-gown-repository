import * as React from 'react';
import {
  Avatar,
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface ImagePreviewDialogProps {
  imageUrl: string | null;
  alt: string;
  title?: string;
  onClose: () => void;
}

export function ImagePreviewDialog({
  imageUrl,
  alt,
  title = 'Image preview',
  onClose,
}: ImagePreviewDialogProps) {
  return (
    <Dialog
      open={Boolean(imageUrl)}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="image-preview-dialog-title"
    >
      <DialogTitle id="image-preview-dialog-title" sx={{ pr: 7 }}>
        {title}
        <IconButton
          aria-label="Close image preview"
          onClick={onClose}
          sx={{ position: 'absolute', right: 12, top: 12 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 1.5, sm: 3 },
        }}
      >
        {imageUrl && (
          <Box
            component="img"
            src={imageUrl}
            alt={alt}
            sx={{
              display: 'block',
              width: '100%',
              maxWidth: '100%',
              maxHeight: { xs: '70vh', sm: '76vh' },
              objectFit: 'contain',
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ImageThumbnailProps {
  src?: string | null;
  alt: string;
  fallback?: string;
  onPreview: (imageUrl: string, alt: string) => void;
  size?: number;
  variant?: 'avatar' | 'box';
}

export function ImageThumbnail({
  src,
  alt,
  fallback = 'No image',
  onPreview,
  size = 48,
  variant = 'box',
}: ImageThumbnailProps) {
  if (!src) {
    return (
      <Box
        sx={{
          width: size,
          height: size,
          borderRadius: 1,
          bgcolor: 'action.hover',
          color: 'text.secondary',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          lineHeight: 1.15,
          textAlign: 'center',
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.15 }}>
          {fallback}
        </Typography>
      </Box>
    );
  }

  return (
    <IconButton
      aria-label={`Preview ${alt}`}
      onClick={() => onPreview(src, alt)}
      sx={{ p: 0.5 }}
    >
      {variant === 'avatar' ? (
        <Avatar
          variant="rounded"
          src={src}
          alt={alt}
          sx={{ width: size, height: size }}
        />
      ) : (
        <Box
          component="img"
          src={src}
          alt={alt}
          sx={{ width: size, height: size, borderRadius: 1, objectFit: 'cover' }}
        />
      )}
    </IconButton>
  );
}
