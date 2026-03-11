import type { RouteObject } from "react-router-dom";

export const appRoutes: RouteObject[] = [
  {
    path: "/",
    element: "<Dashboard />",
  },
  {
    path: "/orders",
    element: "<Orders />",
    children: [
      {
        path: ":orderId",
        element: "<OrderDetails />",
      },
      {
        path: "new",
        element: "<CreateOrder />",
      },
    ],
  },
  {
    path: "/products/:productId/details",
    element: "<ProductDetails />",
  },
];
