const fsp = require('fs/promises')

const CustomDefinedTypes = [
  'couchbase::json_string',
  'couchbase::document_id',
  'couchbase::cas',
  'couchbase::mutation_token',
]

function getTsType(type, typeDb) {
  switch (type.name) {
    case 'std::string':
      return 'string'
    case 'std::chrono::milliseconds':
      return 'CppMilliseconds'
    case 'std::chrono::microseconds':
      return 'CppMilliseconds'
    case 'std::chrono::nanoseconds':
      return 'CppMilliseconds'
    case 'std::chrono::seconds':
      return 'CppMilliseconds'
    case 'std::error_code':
      return 'CppError'
    case 'std::monostate':
      return 'undefined'
    case 'std::size_t':
      return 'number'
    case 'std::int8_t':
      return 'number'
    case 'std::uint8_t':
      return 'number'
    case 'std::int16_t':
      return 'number'
    case 'std::uint16_t':
      return 'number'
    case 'std::int32_t':
      return 'number'
    case 'std::uint32_t':
      return 'number'
    case 'std::int64_t':
      return 'number'
    case 'std::uint64_t':
      return 'number'
    case 'std::bool':
      return 'boolean'
    case 'std::float':
      return 'number'
    case 'std::double':
      return 'number'
    case 'std::optional':
      return getTsType(type.of, typeDb) + ' | undefined'
    case 'std::variant':
      return type.of.map((v) => getTsType(v, typeDb)).join(' | ')
    case 'std::vector':
      return getTsType(type.of, typeDb) + '[]'
    case 'std::array':
      return getTsType(type.of, typeDb) + '[]'
    case 'std::set':
      return getTsType(type.of, typeDb) + '[]'
    case 'std::map':
      return (
        '{[key: string /*' +
        getTsType(type.of, typeDb) +
        '*/]: ' +
        getTsType(type.to, typeDb) +
        '}'
      )

    // special cased types
    //case 'couchbase::json_string':
    //  return 'CppJsonString'
  }

  const opsStructs = typeDb.op_structs
  const foundStruct = opsStructs.find((x) => x.name === type.name)
  if (foundStruct) {
    return getStructTsName(type.name)
  }

  const opsEnums = typeDb.op_enums
  const foundEnum = opsEnums.find((x) => x.name === type.name)
  if (foundEnum) {
    return getEnumTsName(type.name)
  }

  throw new Error('unexpected type:' + JSON.stringify(type))
}

function getCppType(type) {
  if (type.name === 'std::bool') {
    return 'bool'
  } else if (type.name === 'std::int') {
    return 'int'
  } else if (type.name === 'std::double') {
    return 'double'
  } else if (type.name === 'std::float') {
    return 'float'
  } else if (type.name === 'std::vector') {
    const ofType = getCppType(type.of)
    return `${type.name}<${ofType}>`
  } else if (type.name === 'std::optional') {
    const ofType = getCppType(type.of)
    return `${type.name}<${ofType}>`
  } else if (type.name === 'std::set') {
    const ofType = getCppType(type.of)
    return `${type.name}<${ofType}>`
  } else if (type.name === 'std::variant') {
    const ofTypes = type.of.map((x) => getCppType(x)).join(', ')
    return `${type.name}<${ofTypes}>`
  } else if (type.name === 'std::map') {
    const ofType = getCppType(type.of)
    const toType = getCppType(type.to)
    return `${type.name}<${ofType}, ${toType}>`
  } else if (type.name === 'std::array') {
    const ofType = getCppType(type.of)
    const sizeVal = type.size
    return `${type.name}<${ofType}, ${sizeVal}>`
  }

  if (type.of) {
    throw new Error('unexpected type:' + JSON.stringify(type))
  }

  return type.name
}

function getUnprefixedName(name) {
  const basePrefix = 'couchbase::'
  const opsPrefix = 'couchbase::operations::'

  if (name.startsWith(opsPrefix)) {
    name = name.substr(opsPrefix.length)
  } else if (name.startsWith(basePrefix)) {
    name = name.substr(basePrefix.length)
  } else {
    throw new Error('unexpected struct name')
  }

  // replace all namespace separators with underscores
  name = name.replace(/::/g, '_')

  return name
}

function getTsNiceName(name) {
  // drop the prefix
  name = getUnprefixedName(name)

  // convert underscores to camel case
  name = name.replace(/_a/g, 'A')
  name = name.replace(/_b/g, 'B')
  name = name.replace(/_c/g, 'C')
  name = name.replace(/_d/g, 'D')
  name = name.replace(/_e/g, 'E')
  name = name.replace(/_f/g, 'F')
  name = name.replace(/_g/g, 'G')
  name = name.replace(/_h/g, 'H')
  name = name.replace(/_i/g, 'I')
  name = name.replace(/_j/g, 'J')
  name = name.replace(/_k/g, 'K')
  name = name.replace(/_l/g, 'L')
  name = name.replace(/_m/g, 'M')
  name = name.replace(/_n/g, 'N')
  name = name.replace(/_o/g, 'O')
  name = name.replace(/_p/g, 'P')
  name = name.replace(/_q/g, 'Q')
  name = name.replace(/_r/g, 'R')
  name = name.replace(/_s/g, 'S')
  name = name.replace(/_t/g, 'T')
  name = name.replace(/_u/g, 'U')
  name = name.replace(/_v/g, 'V')
  name = name.replace(/_w/g, 'W')
  name = name.replace(/_x/g, 'X')
  name = name.replace(/_y/g, 'Y')
  name = name.replace(/_z/g, 'Z')

  return name
}

function uppercaseFirstLetter(name) {
  return name.substr(0, 1).toUpperCase() + name.substr(1)
}

function getEnumTsName(name) {
  return 'Cpp' + uppercaseFirstLetter(getTsNiceName(name))
}

function getStructTsName(name) {
  return 'Cpp' + uppercaseFirstLetter(getTsNiceName(name))
}

function isIgnoredField(st, fieldName) {
  if (
    fieldName === 'retries' ||
    fieldName === 'ctx' ||
    fieldName === 'row_callback' ||
    fieldName.endsWith('_')
  ) {
    return true
  }

  return false
}

const FILE_WRITER_DEBUG = false
class FileWriter {
  constructor(regionName) {
    this.regionName = regionName
    this.output = ''
  }

  write(data) {
    if (FILE_WRITER_DEBUG) {
      console.log(data)
    }

    this.output += data + '\n'
  }

  genProlog() {
    return `//#region ${this.regionName}`
  }
  genEpilog() {
    return `//#endregion ${this.regionName}`
  }

  async save(filePath) {
    const prolog = this.genProlog()
    const epilog = this.genEpilog()

    let fileOutput = ''
    fileOutput += prolog + '\n'
    fileOutput += this.output
    fileOutput += epilog + '\n'

    await fsp.writeFile(filePath, fileOutput)
  }

  async saveToRegion(filePath) {
    const prolog = this.genProlog()
    const epilog = this.genEpilog()

    const fileDataBuf = await fsp.readFile(filePath)
    const fileData = fileDataBuf.toString('utf-8')

    const prologPos = fileData.indexOf(prolog)
    if (prologPos === -1) {
      throw new Error(
        `failed to insert code into ${filePath} due to missing region ${this.regionName} prolog`
      )
    }
    const epilogPos = fileData.indexOf(epilog)
    if (epilogPos === -1) {
      throw new Error(
        `failed to insert code into ${filePath} due to missing region ${this.regionName} epilog`
      )
    }

    const preProlog = fileData.substr(0, prologPos)
    const postProlog = fileData.substr(epilogPos + epilog.length)

    let fileOutput = ''
    fileOutput += preProlog
    fileOutput += prolog + '\n'
    fileOutput += '\n' + this.output + '\n'
    fileOutput += epilog
    fileOutput += postProlog

    await fsp.writeFile(filePath, fileOutput)
  }
}

async function go() {
  const opsJson = await fsp.readFile('./bindings.json')
  const ops = JSON.parse(opsJson)

  let opsStructs = ops.op_structs
  let opsEnums = ops.op_enums

  // filter out mcbp_noop_request because its currently broken...
  opsStructs = opsStructs.filter(
    (x) => x.name != 'couchbase::operations::mcbp_noop_request'
  )

  const opReqTypes = []
  opsStructs.forEach((opStruct) => {
    if (opStruct.name.endsWith('_request')) {
      const opReqName = opStruct.name.substr(0, opStruct.name.length - 8)
      opReqTypes.push(opReqName)
    }
  })

  // filter out the custom types
  opsStructs = opsStructs.filter((x) => !CustomDefinedTypes.includes(x.name))

  const outJsAll = new FileWriter('Autogenerated Bindings')
  outJsAll.write('')

  /*
  export enum CppViewScanConsistency {}
  */
  opsEnums.forEach((x) => {
    const jsEnumName = getEnumTsName(x.name)
    outJsAll.write(`export enum ${jsEnumName} {}`)
  })
  outJsAll.write('')

  /*
  export interface CppMutateInEntry {
    opcode: CppSubdocOpcode
    flags: CppMutateInPathFlag
    path: string
    param: Buffer
  }
  */
  opsStructs.forEach((opStruct) => {
    const jsTypeName = getStructTsName(opStruct.name)

    outJsAll.write(`export interface ${jsTypeName} {`)
    opStruct.fields.forEach((field) => {
      // ignnore the ctx and retries fields
      if (isIgnoredField(opStruct, field.name)) {
        outJsAll.write(`  // ${field.name}`)
        return
      }

      // special case for optional fields
      if (field.type.name === 'std::optional') {
        const jsFieldName = field.name
        const jsFieldType = getTsType(field.type.of, ops)

        outJsAll.write(`  ${jsFieldName}?: ${jsFieldType}`)
      } else {
        const jsFieldName = field.name
        const jsFieldType = getTsType(field.type, ops)

        outJsAll.write(`  ${jsFieldName}: ${jsFieldType}`)
      }
    })
    outJsAll.write(`}`)
  })
  outJsAll.write('')

  /*
  lookupIn(
    options: ReqType,
    callback: (
      err: CppError | null,
      result: ResType
    ) => void
  ): void
  */
  outJsAll.write('export interface CppConnectionAutogen {')
  opReqTypes.forEach((x) => {
    const jsOpName = getTsNiceName(x)
    const jsReqName = getStructTsName(x + '_request')
    const jsRespName = getStructTsName(x + '_response')

    outJsAll.write(`  ${jsOpName}(`)
    outJsAll.write(`    options: ${jsReqName},`)
    outJsAll.write(`    callback: (`)
    outJsAll.write(`      err: CppError | null,`)
    outJsAll.write(`      result: ${jsRespName}`)
    outJsAll.write(`    ) => void`)
    outJsAll.write(`  ): void`)
  })
  outJsAll.write('}')
  outJsAll.write('')

  /*
  view_scan_consistency: {
    not_bounded: CppViewScanConsistency
    update_after: CppViewScanConsistency
    request_plus: CppViewScanConsistency
  }
  */
  outJsAll.write('export interface CppBindingAutogen {')
  opsEnums.forEach((x) => {
    const jsEnumName = getEnumTsName(x.name)
    const jsPropName = getUnprefixedName(x.name)
    outJsAll.write(`  ${jsPropName}: {`)
    x.values.forEach((y) => {
      const jsValName = y.name
      outJsAll.write(`    ${jsValName}: ${jsEnumName}`)
    })
    outJsAll.write(`  }`)
  })
  outJsAll.write('}')
  outJsAll.write('')

  //outJsAll.write('//#endregion Autogen Code')
  //await outJsAll.save('./out/js_all.ts')
  await outJsAll.saveToRegion('../lib/binding.ts')

  /*
  Napi::Value jsGet(const Napi::CallbackInfo &info);
  */
  const outCppFuncDecls = new FileWriter('Autogenerated Method Declarations')
  opReqTypes.forEach((x) => {
    const cppJsOpName = 'js' + uppercaseFirstLetter(getTsNiceName(x))
    outCppFuncDecls.write(
      ` Napi::Value ${cppJsOpName}(const Napi::CallbackInfo &info);`
    )
  })
  //await outCppFuncDecls.save('./out/cpp_func_decls.hxx')
  await outCppFuncDecls.saveToRegion('../src/connection.hpp')

  /*
  Napi::Value Connection::jsExists(const Napi::CallbackInfo &info)
  {
      auto optsJsObj = info[0].As<Napi::Object>();
      auto callbackJsFn = info[1].As<Napi::Function>();

      executeOp("exists",
                jsToCbpp<couchbase::operations::exists_request>(optsJsObj),
                callbackJsFn);

      return info.Env().Null();
  }
  */
  const outCppFuncDefs = new FileWriter('Autogenerated Method Definitions')
  opReqTypes.forEach((x) => {
    const cppBaseOpName = getTsNiceName(x)
    const cppJsOpName = 'js' + uppercaseFirstLetter(cppBaseOpName)
    outCppFuncDefs.write(
      `Napi::Value Connection::${cppJsOpName}(const Napi::CallbackInfo &info)`
    )
    outCppFuncDefs.write(`{`)
    outCppFuncDefs.write(`    auto optsJsObj = info[0].As<Napi::Object>();`)
    outCppFuncDefs.write(
      `    auto callbackJsFn = info[1].As<Napi::Function>();`
    )
    outCppFuncDefs.write(``)
    outCppFuncDefs.write(`    executeOp("${cppBaseOpName}",`)
    outCppFuncDefs.write(`              jsToCbpp<${x}_request>(optsJsObj),`)
    outCppFuncDefs.write(`              callbackJsFn);`)
    outCppFuncDefs.write(``)
    outCppFuncDefs.write(`    return info.Env().Null();`)
    outCppFuncDefs.write(`}`)
    outCppFuncDefs.write(``)
  })
  //await outCppFuncDefs.save('./out/cpp_func_defs.hxx')
  await outCppFuncDefs.saveToRegion('../src/connection_autogen.cpp')

  // InstanceMethod<&Connection::jsGet>("get"),
  const outCppFuncSpec = new FileWriter('Autogenerated Method Registration')
  opReqTypes.forEach((x) => {
    const cppBaseOpName = getTsNiceName(x)
    const cppJsOpName = 'js' + uppercaseFirstLetter(cppBaseOpName)
    outCppFuncSpec.write(
      `InstanceMethod<&Connection::${cppJsOpName}>("${cppBaseOpName}"),`
    )
  })
  //await outCppFuncSpec.save('./out/cpp_func_specs.hxx')
  await outCppFuncSpec.saveToRegion('../src/connection.cpp')

  /*
    exports.Set(
        "view_scan_consistency",
        cbppEnumToJs<
            couchbase::operations::document_view_request::scan_consistency>(
            env,
            {
                {"not_bounded", couchbase::operations::document_view_request::
                                    scan_consistency::not_bounded},
                {"update_after", couchbase::operations::document_view_request::
                                     scan_consistency::update_after},
                {"request_plus", couchbase::operations::document_view_request::
                                     scan_consistency::request_plus},
            }));
  */
  const outCppEnumDefs = new FileWriter('Autogenerated Constants')
  opsEnums.forEach((x) => {
    const jsPropName = getUnprefixedName(x.name)

    outCppEnumDefs.write(`exports.Set(`)
    outCppEnumDefs.write(`  "${jsPropName}",`)
    outCppEnumDefs.write(`  cbppEnumToJs<${x.name}>(`)
    outCppEnumDefs.write('    env, {')
    x.values.forEach((y) => {
      outCppEnumDefs.write(`      {"${y.name}", ${x.name}::${y.name}},`)
    })
    outCppEnumDefs.write(`    }));`)
    outCppEnumDefs.write(``)
  })
  await outCppEnumDefs.saveToRegion('../src/constants.cpp')
  //await outCppEnumDefs.save('./out/cpp_enum_defs.cpp')

  /*
  template <>
  struct js_to_cbpp_t<couchbase::operations::remove_response> {
      static inline couchbase::operations::remove_request
      from_js(Napi::Value jsVal)
      {
          auto jsObj = jsVal.ToObject();
          couchbase::operations::remove_request cppObj;
          js_to_cbpp(cppObj.cas, jsObj.Get("cas"));
          js_to_cbpp(cppObj.token, jsObj.Get("token"));
          return cppObj;
      }

      static inline Napi::Value
      to_js(Napi::Env env, const couchbase::operations::remove_response &cppObj)
      {
          auto resObj = Napi::Object::New(env);
          resObj.Set("cas", cbpp_to_js(env, cppObj.cas));
          resObj.Set("token", cbpp_to_js(env, cppObj.token));
          return resObj;
      }
  };
  */
  const outCppStructDefs = new FileWriter('Autogenerated Marshalling')
  opsStructs.forEach((st) => {
    outCppStructDefs.write(`template <>`)
    outCppStructDefs.write(`struct js_to_cbpp_t<${st.name}> {`)

    outCppStructDefs.write(`    static inline ${st.name}`)
    outCppStructDefs.write(`    from_js(Napi::Value jsVal)`)
    outCppStructDefs.write(`    {`)
    outCppStructDefs.write(`        auto jsObj = jsVal.ToObject();`)
    outCppStructDefs.write(`        ${st.name} cppObj;`)
    st.fields.forEach((field) => {
      if (isIgnoredField(st, field.name)) {
        outCppStructDefs.write(`        // ${field.name}`)
        return
      }
      const fieldType = getCppType(field.type)
      outCppStructDefs.write(
        `        js_to_cbpp<${fieldType}>(cppObj.${field.name}, jsObj.Get("${field.name}"));`
      )
    })
    outCppStructDefs.write(`        return cppObj;`)
    outCppStructDefs.write(`    }`)

    outCppStructDefs.write(`    static inline Napi::Value`)
    outCppStructDefs.write(`    to_js(Napi::Env env, const ${st.name} &cppObj)`)
    outCppStructDefs.write(`    {`)
    outCppStructDefs.write(`        auto resObj = Napi::Object::New(env);`)
    st.fields.forEach((field) => {
      if (isIgnoredField(st, field.name)) {
        outCppStructDefs.write(`        // ${field.name}`)
        return
      }
      const fieldType = getCppType(field.type)
      outCppStructDefs.write(
        `        resObj.Set("${field.name}", cbpp_to_js<${fieldType}>(env, cppObj.${field.name}));`
      )
    })
    outCppStructDefs.write(`        return resObj;`)
    outCppStructDefs.write(`    }`)

    outCppStructDefs.write(`};`)
    outCppStructDefs.write(``)
  })
  //await outCppStructDefs.save('./out/cpp_struct_defs.cpp')
  await outCppStructDefs.saveToRegion('../src/jstocbpp_autogen.hpp')
}

go()
  .then((res) => console.log('RES:', res))
  .catch((e) => console.error('ERR:', e))
