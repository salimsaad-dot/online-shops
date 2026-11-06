-- AlterTable
ALTER TABLE `Shop` MODIFY `primaryColor` VARCHAR(20) NOT NULL DEFAULT '#1f6b4f';

-- Shops still on the old purple default (never chosen deliberately) move to the new default.
UPDATE `Shop` SET `primaryColor` = '#1f6b4f' WHERE `primaryColor` = '#4f46e5';
