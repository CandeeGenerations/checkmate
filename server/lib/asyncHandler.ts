import type {NextFunction, Request, Response} from 'express'

import {Sentry} from './sentry.js'

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown

export function asyncHandler(fn: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error: unknown) => {
      Sentry.captureException(error)
      next(error)
    })
  }
}
