'use client';

import { useState } from 'react';
import { UpgradeMode } from '@/components/shared/UpgradeModal';

/**
 * Shared hook to control the UpgradeModal from any page.
 * Usage:
 *   const { upgradeModal, openUpgrade, closeUpgrade } = useUpgradeModal();
 *   // render: {upgradeModal && <UpgradeModal mode={upgradeModal} onClose={closeUpgrade} />}
 */
export function useUpgradeModal() {
  const [upgradeModal, setUpgradeModal] = useState<UpgradeMode | null>(null);

  function openUpgrade(mode: UpgradeMode) {
    setUpgradeModal(mode);
  }

  function closeUpgrade(result?: { success: boolean }) {
    setUpgradeModal(null);
    return result;
  }

  return { upgradeModal, openUpgrade, closeUpgrade };
}
