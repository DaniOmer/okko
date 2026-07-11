import { INestApplication } from '@nestjs/common';
import request from 'supertest';

/** Remplit les 10 catégories de complétude d'une fiche existante (crée zone + ravageur globaux). */
export async function fillAllSections(app: INestApplication, cropId: string): Promise<void> {
  const http = app.getHttpServer();
  await request(http).patch(`/crops/${cropId}/requirements`).send({
    climatic: { temperature: { min: 18, optimal: 25, max: 32, unit: '°C' } },
    edaphic: { ph: { min: 5.5, optimal: 6.5, max: 7.5, unit: 'pH' } },
  }).expect(200);
  await request(http).patch(`/crops/${cropId}/phenology`).send({
    stages: [{ name: { fr: 'Levée' }, startDay: 5, endDay: 12, order: 1 }],
  }).expect(200);
  await request(http).patch(`/crops/${cropId}/nutrition`).send({
    requirements: [{ nutrient: 'N', amount: 120, unit: 'kg/ha', basis: 'PER_HECTARE' }],
  }).expect(200);
  await request(http).patch(`/crops/${cropId}/yields`).send({
    yields: [{ inputType: 'CHEMICAL', min: 2, average: 4, potential: 6, unit: 't/ha' }],
  }).expect(200);
  await request(http).post(`/crops/${cropId}/varieties`).send({
    name: { fr: 'Variété test' }, maturityDays: 90, traits: ['précoce'],
  }).expect(201);
  const zone = await request(http).post('/zones').send({
    name: { fr: 'Zone test' }, country: 'BJ', koppen: 'BSh',
  }).expect(201);
  await request(http).put(`/crops/${cropId}/zones/${zone.body.id}`).send({
    rating: 'SUITABLE', justification: 'Convient',
  }).expect(200);
  await request(http).post(`/crops/${cropId}/windows`).send({
    zoneId: zone.body.id, season: 'Hivernage', irrigationRequired: false,
    operations: [{ type: 'PLANTING', label: { fr: 'Semis direct' }, timingDays: 0, inputs: [] }],
  }).expect(201);
  const pest = await request(http).post('/pests').send({
    name: { fr: 'Striga' }, type: 'WEED', scientificName: 'Striga hermonthica',
  }).expect(201);
  await request(http).put(`/crops/${cropId}/pests/${pest.body.id}`).send({
    susceptibility: 'HIGH', sensitiveStages: ['tallage'],
    controlMethods: [{ category: 'PREVENTION', description: { fr: 'Désherbage précoce' }, inputs: [] }],
  }).expect(200);
  await request(http).post(`/crops/${cropId}/prices`).send({
    market: 'Parakou', periodStart: '2026-06-01', price: 200, unit: 'FCFA/kg', currency: 'XOF',
  }).expect(201);
}
