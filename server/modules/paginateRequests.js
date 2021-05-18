const request = require("request-promise");
const _ = require("lodash");

function PaginateRequests(options, limit, items, offset, totalResults = []) {
  return request(options)
    .then((response) => {
      let results;
      try {
        const parsedResponse = JSON.parse(response.body);
        if (parsedResponse instanceof Array) {
          results = parsedResponse;
        } else {
          Object.keys(parsedResponse).forEach((key) => {
            if (parsedResponse[key] instanceof Array) {
              results = parsedResponse[key];
            }
          });
        }
      } catch (error) {
        return new Promise((resolve, reject) => reject(response.statusCode));
      }

      // check if results are the same as previous ones (infinite request loop?)
      let skipping = false;

      if (_.isEqual(results, totalResults)) {
        skipping = true;
      }

      const tempResults = totalResults.concat(results);

      if (skipping || results.length === 0 || (tempResults.length >= limit && limit !== 0)) {
        let finalResults = skipping ? results : tempResults;

        // check if it goes above the limit
        if (tempResults.length > limit && limit !== 0) {
          finalResults = tempResults.slice(0, limit);
        }

        return new Promise((resolve) => resolve(finalResults));
      }

      const newOptions = options;
      newOptions.qs[offset] = parseInt(options.qs[offset], 10) + parseInt(options.qs[items], 10);

      return PaginateRequests(newOptions, limit, items, offset, tempResults);
    })
    .catch((e) => {
      return Promise.reject(e);
    });
}

function PaginateStripe(options, limit, totalResults) {
  return request(options)
    .then((response) => {
      // introduce a delay so Stripe doesn't shut down the request
      return new Promise((resolve) => setTimeout(() => resolve(response), 1200));
    })
    .then((response) => {
      try {
        const result = JSON.parse(response.body);
        const tempResults = result;
        tempResults.data = (
          totalResults && totalResults.data && totalResults.data.concat(result.data)
        ) || result.data;

        if (!result.has_more
          || (tempResults.data && tempResults.data.length >= limit && limit !== 0)
        ) {
          if (tempResults.data.length > limit && limit !== 0) {
            tempResults.data = tempResults.data.slice(0, limit);
          }
          // the recursion ends here
          return new Promise((resolve) => resolve(tempResults));
        }

        // continue the recursion
        const newOptions = options;
        newOptions.qs.starting_after = tempResults.data[tempResults.data.length - 1].id;

        return PaginateStripe(newOptions, limit, tempResults);
      } catch (error) {
        return new Promise((resolve, reject) => reject(response.statusCode));
      }
    })
    .catch((err) => {
      return Promise.reject(err);
    });
}

function PaginateUrl(options, paginationField, limit, totalResults = []) {
  return request(options)
    .then((response) => {
      let results;
      let paginationURL;
      let resultsKey;
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(response.body);
        paginationURL = _.get(parsedResponse, paginationField);
        Object.keys(parsedResponse).forEach((key) => {
          if (parsedResponse[key] instanceof Array) {
            results = parsedResponse[key];
            resultsKey = key;
          }
        });
      } catch (error) {
        return new Promise((resolve, reject) => reject(response.statusCode));
      }

      // check if results are the same as previous ones (infinite request loop?)
      let skipping = false;

      if (_.isEqual(results, totalResults)) {
        skipping = true;
      }

      const tempResults = totalResults.concat(results);

      if (skipping || results.length === 0 || (tempResults.length >= limit && limit !== 0)) {
        let finalResults = skipping ? results : tempResults;

        // check if it goes above the limit
        if (tempResults.length > limit && limit !== 0) {
          finalResults = tempResults.slice(0, limit);
        }

        parsedResponse[resultsKey] = finalResults;
        return new Promise((resolve) => resolve(parsedResponse));
      }

      const newOptions = options;
      newOptions.url = paginationURL;

      return PaginateUrl(newOptions, paginationField, limit, tempResults);
    })
    .catch((err) => {
      return Promise.reject(err);
    });
}

module.exports = (template = "custom", {
  options, limit, items, offset, paginationField,
}) => {
  let results;

  switch (template) {
    case "custom":
      results = PaginateRequests(options, limit, items, offset);
      break;
    case "stripe": {
      // make sure stripe's query parameters include the max limit value
      const stripeOpt = _.cloneDeep(options);
      stripeOpt.qs.limit = 100;
      results = PaginateStripe(stripeOpt, limit);
      break;
    }
    case "url":
      results = PaginateUrl(options, paginationField, limit);
      break;
    default:
      results = PaginateRequests(options, limit, items, offset);
  }

  return results;
};
