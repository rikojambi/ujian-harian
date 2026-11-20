import { registerSW } from 'virtual:pwa-register';

export function registerPwa(): () => void {
  return registerSW({
    immediate: true,
    onNeedRefresh() {
      const accepted = window.confirm('Versi aplikasi baru tersedia. Muat ulang sekarang?');
      if (accepted) window.location.reload();
    },
    onOfflineReady() {
      console.info('[UJIAN HARIAN] Antarmuka siap digunakan offline.');
    }
  });
}
