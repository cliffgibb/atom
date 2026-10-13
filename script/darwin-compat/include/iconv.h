// Compatibility shim for building old native modules against newer macOS SDKs.
//
// Recent SDKs changed `iconv_t` from `void *` to an opaque struct pointer.
// superstring 2.4.4 stores the converter as `void *` and passes it (or an
// `iconv_t *` cast of it) straight to iconv()/iconv_close(), which only
// compiled while `iconv_t` was `void *`. These C++ overloads restore that
// implicit conversion without changing the pointer value that is passed.

#include_next <iconv.h>

#if defined(__cplusplus) && !defined(ATOM_DARWIN_COMPAT_ICONV)
#define ATOM_DARWIN_COMPAT_ICONV

inline int iconv_close(void *cd) {
  return iconv_close(reinterpret_cast<iconv_t>(cd));
}

inline size_t iconv(iconv_t *cd, char **inbuf, size_t *inbytesleft,
                    char **outbuf, size_t *outbytesleft) {
  return iconv(reinterpret_cast<iconv_t>(cd), inbuf, inbytesleft, outbuf,
               outbytesleft);
}

#endif
