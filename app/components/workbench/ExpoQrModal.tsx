import React from 'react';
import { Dialog, DialogTitle, DialogDescription, DialogRoot } from '~/components/ui/Dialog';
import { useStore } from '@nanostores/react';
import { expoUrlAtom } from '~/lib/stores/qrCodeStore';
import { QRCode } from 'react-qrcode-logo';

interface ExpoQrModalProps {
  open: boolean;
  onClose: () => void;
}

export const ExpoQrModal: React.FC<ExpoQrModalProps> = ({ open, onClose }) => {
  const expoUrl = useStore(expoUrlAtom);

  return (
    <DialogRoot open={open} onOpenChange={(v) => !v && onClose()} >
      <Dialog
        className="text-center !flex-col !mx-auto !text-center !max-w-md"
        
        showCloseButton={true}
        onClose={onClose}
      >
        <div style={{fontFamily:'Funnel Display'}} className="border !border-bolt-elements-borderColor flex flex-col gap-5 justify-center items-center p-6 bg-white rounded-md">
          <div className="i-bolt:expo h-10 w-full invert dark:invert-none"></div>
          <DialogTitle className=" text-lg font-semibold leading-6">
            Preview on your own mobile device
          </DialogTitle>
          <DialogDescription className="bg-[#fafafa] max-w-sm rounded-[12px] p-1  border-bolt-elements-borderColor">
            Scan this QR code with the Expo Go app on your mobile device to open your project.
          </DialogDescription>
          <div className="my-6 flex flex-col items-center">
            {expoUrl ? (
              <QRCode
                logoImage="/icon.svg"

                removeQrCodeBehindLogo={true}
                logoPadding={3}
                logoHeight={50}
                logoWidth={50}
                logoPaddingStyle="square"
                style={{
                  borderRadius: 16,
                  padding: 2,
                  
                }}
                value={expoUrl}
                size={200}
              />
            ) : (
              <div className="text-gray-500 text-center">No Expo URL detected.</div>
            )}
          </div>
        </div>
      </Dialog>
    </DialogRoot>
  );
};
