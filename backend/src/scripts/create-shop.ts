/**
 * Creates a shop with its owner account (same as the platform panel, for scripting).
 *   npm run create-shop -- --name "Baaba Hanson" --slug baabahanson --owner-email owner@x.com \
 *     --owner-password "s3cret-pass" [--owner-name "Owner"] [--currency GHS] [--prefix BH] \
 *     [--domain baabahanson.com --domain www.baabahanson.com]
 */
import { parseArgs } from 'node:util';
import { prisma } from '../lib/prisma';
import { createShopWithOwner } from '../modules/platform/shop.provisioning';

async function main() {
  const { values } = parseArgs({
    options: {
      name: { type: 'string' },
      slug: { type: 'string' },
      currency: { type: 'string', default: 'GHS' },
      prefix: { type: 'string', default: 'ORD' },
      domain: { type: 'string', multiple: true, default: [] },
      'owner-name': { type: 'string', default: 'Shop Owner' },
      'owner-email': { type: 'string' },
      'owner-password': { type: 'string' },
    },
  });
  if (!values.name || !values.slug || !values['owner-email'] || !values['owner-password']) {
    throw new Error('Required: --name --slug --owner-email --owner-password');
  }
  if ((values['owner-password'] ?? '').length < 8) throw new Error('Owner password must be at least 8 characters');

  const { shop, owner } = await createShopWithOwner({
    name: values.name,
    slug: values.slug.toLowerCase(),
    currency: values.currency.toUpperCase(),
    orderPrefix: values.prefix.toUpperCase(),
    domains: values.domain,
    owner: { name: values['owner-name'], email: values['owner-email'], password: values['owner-password'] },
  });
  console.log(`✅ Shop "${shop.name}" (#${shop.id}, slug ${shop.slug}) created with owner ${owner.email}`);
  console.log(`   Local URL: http://${shop.slug}.localhost:3001`);
}

main()
  .catch((e) => {
    console.error('❌', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
