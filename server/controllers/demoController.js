const demoService = require('../demo/service');
const logAudit = require('../utils/auditLogger');

function demoCounts(status) {
  return {
    transactions: status.transactions,
    budgets: status.budgets,
    recurring: status.recurring,
    plans: status.plans,
  };
}

exports.getStatus = async (req, res, next) => {
  try {
    res.json(await demoService.getDemoStatus(req.user.id));
  } catch (err) {
    next(err);
  }
};

exports.load = async (req, res, next) => {
  try {
    const result = await demoService.loadDemoData(req.user.id);

    if (!result.alreadyLoaded) {
      logAudit(
        req.user.id,
        'demo_data_loaded',
        'demo',
        `Loaded ${result.loaded.transactions} demo transaction(s), ${result.loaded.budgets} budget(s), ${result.loaded.recurring} recurring template(s) and ${result.loaded.plans} monthly plan(s)`,
        req.ip
      );
    }

    res.status(result.alreadyLoaded ? 200 : 201).json(result);
  } catch (err) {
    next(err);
  }
};

exports.purge = async (req, res, next) => {
  try {
    if (!req.body || req.body.confirm !== true) {
      const status = await demoService.getDemoStatus(req.user.id);
      return res.status(409).json({
        error: 'Confirm the removal of demo data before continuing.',
        requiresConfirmation: true,
        demo: demoCounts(status),
      });
    }

    const result = await demoService.purgeDemoData(req.user.id);
    const removedTotal =
      result.removed.transactions +
      result.removed.budgets +
      result.removed.recurring +
      result.removed.plans;

    if (removedTotal > 0) {
      logAudit(
        req.user.id,
        'demo_data_purged',
        'demo',
        `Removed ${result.removed.transactions} demo transaction(s), ${result.removed.budgets} budget(s), ${result.removed.recurring} recurring template(s) and ${result.removed.plans} monthly plan(s)`,
        req.ip
      );
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
};
