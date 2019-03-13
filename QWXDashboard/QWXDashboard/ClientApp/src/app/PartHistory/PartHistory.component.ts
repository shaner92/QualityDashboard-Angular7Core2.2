import { Component, Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CollectionViewer, SelectionChange } from '@angular/cdk/collections';
import { FlatTreeControl } from '@angular/cdk/tree';
import { BehaviorSubject, merge, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

//@Component({
//  selector: 'app-PartHistory-component',
//  templateUrl: './PartHistory.component.html'
//})
export class PartHistoryComponent {
  public data: parthistory[];

  constructor(http: HttpClient, @Inject('BASE_URL') baseUrl: string) {
    http.get<parthistory[]>(baseUrl + 'api/PartHistory/data').subscribe(result => {
      this.data = result;
    }, error => console.error(error));
  }
  
}
//interface parthistory {
//  serialNumber: string;
//}
/** Flat node with expandable and level information */
export class PartHistoryNode {
    constructor(public item: string, public level = 1, public expandable = false,
        public isLoading = false) { }
}

/**
 * Database for dynamic data. When expanding a node in the tree, the data source will need to fetch
 * the descendants data from the database.
 */
interface parthistory {
    serialNumber: string;
}

export class PartHistoryDatabase {
  
    dataMap = new Map<string, string[]>([
        ['Fruits', ['Apple', 'Orange', 'Banana']],
        ['Vegetables', ['Tomato', 'Potato', 'Onion']],
        ['Apple', ['Fuji', 'Macintosh']],
        ['Onion', ['Yellow', 'White', 'Purple']]
    ]);

    rootLevelNodes: string[] = ['Fruits', 'Vegetables'];

    /** Initial data from database */
    initialData(): PartHistoryNode[] {
        return this.rootLevelNodes.map(name => new PartHistoryNode(name, 0, true));
    }

    getChildren(node: string): string[] | undefined {
        return this.dataMap.get(node);
    }

    isExpandable(node: string): boolean {
        return this.dataMap.has(node);
    }
}
/**
 * File database, it can build a tree structured Json object from string.
 * Each node in Json object represents a file or a directory. For a file, it has filename and type.
 * For a directory, it has filename and children (a list of files or directories).
 * The input will be a json object string, and the output is a list of `FileNode` with nested
 * structure.
 */
@Injectable()
export class PartHistoryDataSource {

    dataChange = new BehaviorSubject<PartHistoryNode[]>([]);

    get data(): PartHistoryNode[] { return this.dataChange.value; }
    set data(value: PartHistoryNode[]) {
        this.treeControl.dataNodes = value;
        this.dataChange.next(value);
    }

    constructor(private treeControl: FlatTreeControl<PartHistoryNode>,
        private database: PartHistoryDatabase) { }

    connect(collectionViewer: CollectionViewer): Observable<PartHistoryNode[]> {
        this.treeControl.expansionModel.onChange.subscribe(change => {
            if ((change as SelectionChange<PartHistoryNode>).added ||
                (change as SelectionChange<PartHistoryNode>).removed) {
                this.handleTreeControl(change as SelectionChange<PartHistoryNode>);
            }
        });

        return merge(collectionViewer.viewChange, this.dataChange).pipe(map(() => this.data));
    }

    /** Handle expand/collapse behaviors */
    handleTreeControl(change: SelectionChange<PartHistoryNode>) {
        if (change.added) {
            change.added.forEach(node => this.toggleNode(node, true));
        }
        if (change.removed) {
            change.removed.slice().reverse().forEach(node => this.toggleNode(node, false));
        }
    }

    /**
     * Toggle the node, remove from display list
     */
    toggleNode(node: PartHistoryNode, expand: boolean) {
        const children = this.database.getChildren(node.item);
        const index = this.data.indexOf(node);
        if (!children || index < 0) { // If no children, or cannot find the node, no op
            return;
        }

        node.isLoading = true;

        setTimeout(() => {
            if (expand) {
                const nodes = children.map(name =>
                    new PartHistoryNode(name, node.level + 1, this.database.isExpandable(name)));
                this.data.splice(index + 1, 0, ...nodes);
            } else {
                let count = 0;
                for (let i = index + 1; i < this.data.length
                    && this.data[i].level > node.level; i++ , count++) { }
                this.data.splice(index + 1, count);
            }

            // notify the change
            this.dataChange.next(this.data);
            node.isLoading = false;
        }, 1000);
    }
}

/**
 * @title Tree with dynamic data
 */
@Component({
    selector: 'app-PartHistory-component',
    templateUrl: './PartHistory.component.html',
    providers: [PartHistoryDatabase]
})
export class TreeDynamicExample {
    constructor(database: PartHistoryDatabase) {
        this.treeControl = new FlatTreeControl<PartHistoryNode>(this.getLevel, this.isExpandable);
        this.dataSource = new PartHistoryDataSource(this.treeControl, database);

        this.dataSource.data = database.initialData();
    }

    treeControl: FlatTreeControl<PartHistoryNode>;

    dataSource: PartHistoryDataSource;

    getLevel = (node: PartHistoryNode) => node.level;

    isExpandable = (node: PartHistoryNode) => node.expandable;

    hasChild = (_: number, _nodeData: PartHistoryNode) => _nodeData.expandable;
}
