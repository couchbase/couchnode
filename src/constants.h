#pragma once
#ifndef CONSTANTS_H
#define CONSTANTS_H

#include <nan.h>
#include <node.h>

namespace couchnode
{

using namespace v8;

namespace constants
{

NAN_MODULE_INIT(Init);

} // namespace constants

} // namespace couchnode

#endif // CONSTANTS_H
