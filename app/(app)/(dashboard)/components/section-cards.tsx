import { TrendingDown, TrendingUp, DollarSign, Users, Package, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function SectionCards() {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:shadow-sm *:data-[slot=card]:border lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <DollarSign className="size-4" />
            Monthly Revenue
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            $48,250
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="text-primary border-primary/30">
              <TrendingUp className="size-3" />
              +8.2%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Above target this month <TrendingUp className="size-4 text-primary" />
          </div>
          <div className="text-muted-foreground">
            Compared to last month
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <Users className="size-4" />
            Active Customers
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            127
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="text-primary border-primary/30">
              <TrendingUp className="size-3" />
              +5
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            5 new accounts this month <TrendingUp className="size-4 text-primary" />
          </div>
          <div className="text-muted-foreground">
            Customer base growing
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <Package className="size-4" />
            Products in Stock
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            342
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="text-amber-600 border-amber-600/30">
              <TrendingDown className="size-3" />
              -12
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Inventory levels healthy
          </div>
          <div className="text-muted-foreground">
            8 items need reorder soon
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <Truck className="size-4" />
            Active Suppliers
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            24
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="text-primary border-primary/30">
              <TrendingUp className="size-3" />
              +2
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Supply chain stable <TrendingUp className="size-4 text-primary" />
          </div>
          <div className="text-muted-foreground">All suppliers active</div>
        </CardFooter>
      </Card>
    </div>
  );
}
