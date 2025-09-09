import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../utils/validation';
import { startTrip, stopTrip, ingestLocation } from '../controllers/tripController';
import { listTrips, getTripDetail, updateTripDetails, batchIngestLocations, logTripEvent } from '../controllers/tripAnalyticsController';
import Joi from 'joi';
import { authRateLimiter } from '../middleware/security';

const router = Router();

const startTripSchema = Joi.object({
  timestamp: Joi.alternatives(Joi.date(), Joi.number()).optional(),
  lat: Joi.number().optional(),
  lng: Joi.number().optional(),
  deviceId: Joi.string().optional(),
  modes: Joi.array().items(Joi.string().valid('car', 'bike', 'walk', 'run', 'transit')).optional(),
  companions: Joi.array().items(Joi.object({ name: Joi.string().required(), phone: Joi.string().optional() })).optional(),
  destLat: Joi.number().optional(),
  destLng: Joi.number().optional(),
  destAddress: Joi.string().max(1024).optional(),
});

const ingestSchema = Joi.object({
  tripId: Joi.string().required(),
  timestamp: Joi.alternatives(Joi.date(), Joi.number()).optional(),
  lat: Joi.number().required(),
  lng: Joi.number().required(),
  mode: Joi.string().valid('car', 'bike', 'walk', 'run', 'transit').optional(),
  speed: Joi.number().optional(),
  accuracy: Joi.number().optional(),
  heading: Joi.number().optional(),
});

const stopTripSchema = Joi.object({
  tripId: Joi.string().required(),
  timestamp: Joi.alternatives(Joi.date(), Joi.number()).optional(),
  lat: Joi.number().optional(),
  lng: Joi.number().optional(),
});

const batchIngestSchema = Joi.object({
  tripId: Joi.string().required(),
  points: Joi.array().items(Joi.object({
    clientId: Joi.string().optional(),
    timestamp: Joi.alternatives(Joi.date(), Joi.number()).optional(),
    lat: Joi.number().required(),
    lng: Joi.number().required(),
    mode: Joi.string().valid('car', 'bike', 'walk', 'run', 'transit').optional(),
    speed: Joi.number().optional(),
    accuracy: Joi.number().optional(),
    heading: Joi.number().optional(),
  })).min(1).max(1000).required(),
});

const updateTripSchema = Joi.object({
  modes: Joi.array().items(Joi.string().valid('car', 'bike', 'walk', 'run', 'transit')).optional(),
  companions: Joi.array().items(Joi.object({ name: Joi.string().required(), phone: Joi.string().optional() })).optional(),
  destLat: Joi.number().optional(),
  destLng: Joi.number().optional(),
  destAddress: Joi.string().max(1024).optional(),
});

const eventSchema = Joi.object({
  tripId: Joi.string().required(),
  type: Joi.string().max(64).required(),
  data: Joi.object().optional(),
});

router.post('/start-trip', authRateLimiter, authenticateToken, validateRequest(startTripSchema), startTrip);
router.post('/ingest-location', authRateLimiter, authenticateToken, validateRequest(ingestSchema), ingestLocation);
router.post('/stop-trip', authRateLimiter, authenticateToken, validateRequest(stopTripSchema), stopTrip);
router.post('/batch-ingest', authRateLimiter, authenticateToken, validateRequest(batchIngestSchema), batchIngestLocations);
router.get('/', authRateLimiter, authenticateToken, listTrips);
router.get('/:tripId', authRateLimiter, authenticateToken, getTripDetail);
router.patch('/:tripId', authRateLimiter, authenticateToken, validateRequest(updateTripSchema), updateTripDetails);
router.post('/event', authRateLimiter, authenticateToken, validateRequest(eventSchema), logTripEvent);

export default router;


