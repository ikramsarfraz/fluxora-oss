ALTER TYPE "inventory_item_status" ADD VALUE IF NOT EXISTS 'picked';
ALTER TYPE "inventory_item_status" ADD VALUE IF NOT EXISTS 'packed';
ALTER TYPE "inventory_item_status" ADD VALUE IF NOT EXISTS 'shipped';
