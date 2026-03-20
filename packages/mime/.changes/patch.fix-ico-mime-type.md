Fix .ico extension to resolve to image/x-icon instead of image/vnd.microsoft.icon

The ICO file format originated with Microsoft Windows, and `image/x-icon` is the
historically preferred MIME type used by browsers and tools. While `image/vnd.microsoft.icon`
is IANA-registered, the de facto standard for .ico files is `image/x-icon`.
