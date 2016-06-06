'use strict';

function TermFacet(field, size) {
  this.field = field;
  this.size = size;
}
module.exports.TermFacet = TermFacet;

module.exports.term = function(field, size) {
  return new TermFacet(field, size);
};

function NumericFacet(field, size) {
  this.field = field;
  this.size = size;
  this.numeric_ranges = [];
}
module.exports.NumericFacet = NumericFacet;

module.exports.numeric = function(field, size) {
  return new NumericFacet(field, size);
};

NumericFacet.prototype.addRange = function(name, start, end) {
  this.numeric_ranges.push({
    name: name,
    start: start,
    end: end
  });
  return this;
};

function DateFacet(field, size) {
  this.field = field;
  this.size = size;
  this.date_ranges = [];
}
module.exports.DateFacet = DateFacet;

module.exports.date = function(field, size) {
  return new DateFacet(field, size);
};

DateFacet.prototype.addRange = function(name, start, end) {
  this.date_ranges.push({
    name: name,
    start: start,
    end: end
  });
  return this;
};

